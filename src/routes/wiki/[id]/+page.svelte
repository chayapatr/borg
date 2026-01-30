<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ServiceFactory } from '$lib/services/ServiceFactory';
	import type { IWikiService } from '$lib/services/interfaces/IWikiService';
	import type { ITaskService } from '$lib/services/interfaces/ITaskService';
	import type { WikiEntry } from '$lib/types/wiki';
	import type { Task } from '$lib/types/task';
	import { Save, Plus } from '@lucide/svelte';
	import WikiBlock from '$lib/components/wiki/WikiBlock.svelte';
	import WikiTaskBlock from '$lib/components/wiki/WikiTaskBlock.svelte';
	import WikiTaskSidebar from '$lib/components/wiki/WikiTaskSidebar.svelte';
	import WikiPageBlock from '$lib/components/wiki/WikiPageBlock.svelte';
	import WikiProjectBlock from '$lib/components/wiki/WikiProjectBlock.svelte';
	import WikiPageSidebar from '$lib/components/wiki/WikiPageSidebar.svelte';
	import WikiProjectSidebar from '$lib/components/wiki/WikiProjectSidebar.svelte';

	// Block types
	interface TextBlock {
		type: 'text';
		content: string;
	}

	interface TaskBlock {
		type: 'task';
		taskId: string;
	}

	interface PageBlock {
		type: 'page';
		pageId: string;
	}

	interface ProjectBlock {
		type: 'project';
		projectSlug: string;
	}

	type Block = TextBlock | TaskBlock | PageBlock | ProjectBlock;

	const wikiId = $derived($page.params.id);

	let wikiService: IWikiService;
	let taskService: ITaskService;
	let entry = $state<WikiEntry | null>(null);
	let loading = $state(true);
	let saving = $state(false);
	let subscriptionCleanup: (() => void) | null = null;

	// Local state for editing
	let title = $state('');
	let blocks = $state<Block[]>([{ type: 'text', content: '' }]);
	let hasChanges = $state(false);

	// Tasks state - use Map to keep resolved tasks visible
	let tasksMap = $state<Map<string, Task>>(new Map());
	let taskSubscriptionCleanup: (() => void) | null = null;

	// Sidebar state
	let showTaskSidebar = $state(false);
	let showPageSidebar = $state(false);
	let showProjectSidebar = $state(false);
	let editingTask = $state<Task | null>(null);
	let pendingTaskBlockIndex = $state<number | null>(null);
	let pendingPageBlockIndex = $state<number | null>(null);
	let pendingProjectBlockIndex = $state<number | null>(null);

	// Block refs for focus management
	let blockRefs: (WikiBlock | null)[] = $state([]);

	// Autosave timer
	let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

	// Parse content to blocks (just text blocks now)
	// Note: page, project, and task links are now inline within text blocks
	function contentToBlocks(content: string): Block[] {
		if (!content) return [{ type: 'text', content: '' }];

		const lines = content.split(/\n\n+/);
		const result: Block[] = [];

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) continue;

			// All content is text blocks - page, project, and task links are inline
			// They stay within the text content as [[page:id]], [[project:slug]], or [[task:id]]
			result.push({ type: 'text', content: trimmed });
		}

		return result.length > 0 ? result : [{ type: 'text', content: '' }];
	}

	// Convert blocks back to content
	function blocksToContent(blocks: Block[]): string {
		return blocks
			.map((block) => {
				if (block.type === 'task') {
					return `[[task:${block.taskId}]]`;
				}
				// Page and project blocks shouldn't exist anymore, but handle them just in case
				if (block.type === 'page') {
					return `[[page:${block.pageId}]]`;
				}
				if (block.type === 'project') {
					return `[[project:${block.projectSlug}]]`;
				}
				return block.content;
			})
			.filter((s) => s.trim() !== '')
			.join('\n\n');
	}

	// Get task by ID
	function getTask(taskId: string): Task | undefined {
		return tasksMap.get(taskId);
	}

	// Watch for wikiId changes and reload
	$effect(() => {
		// This effect runs whenever wikiId changes
		// Only load if services are initialized (after onMount)
		if (wikiId && wikiService && taskService) {
			loadEntry();
			loadTasks();
		}
	});

	onMount(() => {
		wikiService = ServiceFactory.createWikiService();
		taskService = ServiceFactory.createTaskService();

		// Initial load
		loadEntry();
		loadTasks();

		// Setup navigation helpers for inline links
		(window as any).__navigateToPage = (pageId: string) => {
			window.open(`/wiki/${pageId}`, '_blank');
		};
		(window as any).__navigateToProject = (projectSlug: string) => {
			window.open(`/project/${projectSlug}`, '_blank');
		};

		// Setup task helpers for inline tasks
		(window as any).__getTask = (taskId: string) => {
			return getTask(taskId);
		};
		(window as any).__editTask = (taskId: string) => {
			handleEditTask(taskId);
		};
		(window as any).__toggleTask = async (taskId: string) => {
			const task = getTask(taskId);
			if (task) {
				if (task.status === 'resolved') {
					// Unresolve task
					await taskService.updateTask(wikiId, taskId, { status: 'active' });
					tasksMap.set(taskId, { ...task, status: 'active' });
					tasksMap = new Map(tasksMap);
				} else {
					await handleResolveTask(taskId);
				}
			}
		};

		return () => {
			if (subscriptionCleanup) {
				subscriptionCleanup();
			}
			if (taskSubscriptionCleanup) {
				taskSubscriptionCleanup();
			}
			if (autosaveTimer) {
				clearTimeout(autosaveTimer);
			}
			// Cleanup navigation helpers
			delete (window as any).__navigateToPage;
			delete (window as any).__navigateToProject;
			// Cleanup task helpers
			delete (window as any).__getTask;
			delete (window as any).__editTask;
			delete (window as any).__toggleTask;
		};
	});

	async function loadEntry() {
		if (!wikiId) {
			goto('/wiki');
			return;
		}

		if ((wikiService as any).subscribeToEntry) {
			subscriptionCleanup = (wikiService as any).subscribeToEntry(
				wikiId,
				(updatedEntry: WikiEntry | null) => {
					if (updatedEntry) {
						entry = updatedEntry;
						// Only update local state if there are no pending changes
						if (!hasChanges) {
							title = updatedEntry.title;
							blocks = contentToBlocks(updatedEntry.content);
						}
					} else {
						// Entry doesn't exist, redirect to wiki index
						goto('/wiki');
					}
					loading = false;
				}
			);
		} else {
			const result = wikiService.getEntry(wikiId);
			entry = result instanceof Promise ? await result : result;
			if (entry) {
				title = entry.title;
				blocks = contentToBlocks(entry.content);
			} else {
				goto('/wiki');
			}
			loading = false;
		}
	}

	async function loadTasks() {
		if (!wikiId) return;

		// Subscribe to tasks for this wiki (using wikiId as nodeId)
		// Include resolved tasks since wiki displays all tasks in blocks
		if (taskService.subscribeToNodeTasks) {
			taskSubscriptionCleanup = taskService.subscribeToNodeTasks(
				wikiId,
				(updatedTasks) => {
					// Replace map with fresh data from subscription
					tasksMap = new Map(updatedTasks.map((t) => [t.id, t]));
				},
				undefined, // no projectSlug
				true // includeResolved
			);
		} else {
			const result = taskService.getNodeTasks(wikiId);
			const tasksList = result instanceof Promise ? await result : result;
			tasksMap = new Map(tasksList.map((t) => [t.id, t]));
		}
	}

	function handleTitleChange(e: Event) {
		const target = e.target as HTMLInputElement;
		title = target.value;
		hasChanges = true;
		scheduleAutosave();
	}

	function handleBlockUpdate(index: number, content: string) {
		const block = blocks[index];
		if (block.type === 'text') {
			block.content = content;
			blocks = [...blocks]; // Trigger reactivity
			hasChanges = true;
			scheduleAutosave();
		}
	}

	function handleBlockEnter(index: number) {
		// Insert a new text block after the current one
		blocks = [
			...blocks.slice(0, index + 1),
			{ type: 'text', content: '' },
			...blocks.slice(index + 1)
		];
		hasChanges = true;
		scheduleAutosave();

		// Focus the new block
		requestAnimationFrame(() => {
			const newBlockRef = blockRefs[index + 1];
			if (newBlockRef) {
				newBlockRef.focus();
			}
		});
	}

	function handleInsertBlock(index: number) {
		// Insert a new text block at the given index
		blocks = [
			...blocks.slice(0, index),
			{ type: 'text', content: '' },
			...blocks.slice(index)
		];
		hasChanges = true;
		scheduleAutosave();

		// Focus the new block
		requestAnimationFrame(() => {
			const newBlockRef = blockRefs[index];
			if (newBlockRef) {
				newBlockRef.focus();
			}
		});
	}

	function handleBlockDelete(index: number) {
		if (blocks.length <= 1) {
			// Don't delete the last block, just clear it
			blocks = [{ type: 'text', content: '' }];
			return;
		}

		const block = blocks[index];

		// If it's a task block, also delete the task
		if (block.type === 'task') {
			taskService.deleteTask(wikiId, block.taskId);
		}

		// Remove the block
		blocks = [...blocks.slice(0, index), ...blocks.slice(index + 1)];
		hasChanges = true;
		scheduleAutosave();

		// Focus the previous block (or first if we deleted the first)
		requestAnimationFrame(() => {
			const focusIndex = Math.max(0, index - 1);
			const prevBlock = blocks[focusIndex];
			if (prevBlock?.type === 'text') {
				const prevBlockRef = blockRefs[focusIndex];
				if (prevBlockRef) {
					prevBlockRef.focus();
				}
			}
		});
	}

	function handleCreateTask(callback: (taskId: string) => void) {
		// Store the callback for when a task is created
		(window as any).__taskCreateCallback = callback;
		pendingTaskBlockIndex = null; // No longer inserting blocks
		editingTask = null;
		showTaskSidebar = true;
	}

	function handleEditTask(taskId: string) {
		const task = getTask(taskId);
		if (task) {
			editingTask = task;
			showTaskSidebar = true;
		}
	}

	async function handleResolveTask(taskId: string) {
		await taskService.resolveTask(wikiId, taskId);
		// Update task locally to show resolved state immediately
		const task = tasksMap.get(taskId);
		if (task) {
			tasksMap.set(taskId, { ...task, status: 'resolved' });
			tasksMap = new Map(tasksMap); // Trigger reactivity
		}
	}

	function handleTaskSidebarClose() {
		showTaskSidebar = false;
		editingTask = null;
		pendingTaskBlockIndex = null;
		delete (window as any).__taskCreateCallback;
	}

	async function handleTaskSave(task: Task) {
		// Add/update task in local map
		tasksMap.set(task.id, task);
		tasksMap = new Map(tasksMap);

		// If this was a new task created inline, call the callback
		const callback = (window as any).__taskCreateCallback;
		if (callback) {
			callback(task.id);
		}

		// If this was a new task from old block-based system, insert a task block
		if (pendingTaskBlockIndex !== null) {
			// Replace the empty text block with a task block
			blocks = [
				...blocks.slice(0, pendingTaskBlockIndex),
				{ type: 'task', taskId: task.id },
				{ type: 'text', content: '' },
				...blocks.slice(pendingTaskBlockIndex + 1)
			];
			hasChanges = true;
			scheduleAutosave();
		}

		handleTaskSidebarClose();
	}

	async function handleTaskDelete() {
		if (editingTask) {
			// Remove from local map
			tasksMap.delete(editingTask.id);
			tasksMap = new Map(tasksMap);

			// Find and remove the task block
			const taskBlockIndex = blocks.findIndex(
				(b) => b.type === 'task' && b.taskId === editingTask!.id
			);
			if (taskBlockIndex !== -1) {
				blocks = [...blocks.slice(0, taskBlockIndex), ...blocks.slice(taskBlockIndex + 1)];
				if (blocks.length === 0) {
					blocks = [{ type: 'text', content: '' }];
				}
				hasChanges = true;
				scheduleAutosave();
			}
		}

		handleTaskSidebarClose();
	}

	// Page link handlers - now uses callback pattern
	function handleLinkPage(callback: (pageId: string) => void) {
		// Store the callback for when a page is selected
		(window as any).__pageLinkCallback = callback;
		showPageSidebar = true;
	}

	function handlePageSidebarClose() {
		showPageSidebar = false;
		delete (window as any).__pageLinkCallback;
	}

	function handlePageSelect(pageId: string) {
		const callback = (window as any).__pageLinkCallback;
		if (callback) {
			callback(pageId);
		}
		handlePageSidebarClose();
	}

	function handlePageBlockClick(pageId: string) {
		goto(`/wiki/${pageId}`);
	}

	// Project link handlers - now uses callback pattern
	function handleLinkProject(callback: (projectSlug: string) => void) {
		// Store the callback for when a project is selected
		(window as any).__projectLinkCallback = callback;
		showProjectSidebar = true;
	}

	function handleProjectSidebarClose() {
		showProjectSidebar = false;
		delete (window as any).__projectLinkCallback;
	}

	function handleProjectSelect(projectSlug: string) {
		const callback = (window as any).__projectLinkCallback;
		if (callback) {
			callback(projectSlug);
		}
		handleProjectSidebarClose();
	}

	function handleProjectBlockClick(projectSlug: string) {
		goto(`/project/${projectSlug}`);
	}

	function handleDeletePageBlock(index: number) {
		blocks = [...blocks.slice(0, index), ...blocks.slice(index + 1)];
		if (blocks.length === 0) {
			blocks = [{ type: 'text', content: '' }];
		}
		hasChanges = true;
		scheduleAutosave();
	}

	function handleDeleteProjectBlock(index: number) {
		blocks = [...blocks.slice(0, index), ...blocks.slice(index + 1)];
		if (blocks.length === 0) {
			blocks = [{ type: 'text', content: '' }];
		}
		hasChanges = true;
		scheduleAutosave();
	}

	function scheduleAutosave() {
		if (autosaveTimer) {
			clearTimeout(autosaveTimer);
		}
		autosaveTimer = setTimeout(() => {
			save();
		}, 1000);
	}

	async function save() {
		if (!hasChanges || saving || !wikiId) return;

		saving = true;
		await wikiService.updateEntry(wikiId, {
			title,
			content: blocksToContent(blocks)
		});
		hasChanges = false;
		saving = false;
	}

	async function handleSave() {
		if (autosaveTimer) {
			clearTimeout(autosaveTimer);
		}
		await save();
	}

	// Keyboard shortcuts
	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			handleSave();
		}
	}
</script>

<svelte:head>
	<title>{title || 'Wiki'} | BORG</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-screen w-full flex-col bg-white">
	<!-- Header - full width navbar -->
	<div
		class="flex h-16 shrink-0 items-center justify-between border-b border-black bg-borg-white px-6"
	>
		<div class="flex items-center gap-4">
			<a href="/"> <img src="/BORG.svg" class="h-8" alt="BORG" /></a>
			<div class="h-6 w-px bg-black"></div>
			<span class="text-sm">
				{#if saving}
					Saving...
				{:else if hasChanges}
					Unsaved changes
				{:else}
					Saved
				{/if}
			</span>
		</div>
		<button
			onclick={handleSave}
			disabled={!hasChanges || saving}
			class="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
		>
			<Save class="h-4 w-4" />
			Save
		</button>
	</div>

	<!-- Content area with sidebar -->
	<div class="flex min-h-0 flex-1">
		<!-- Main content - full width, ends where sidebar starts -->
		<div class="flex flex-1 flex-col overflow-hidden">
			<!-- Content -->
			{#if loading}
			<div class="flex flex-1 items-center justify-center">
				<div
					class="h-8 w-8 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent"
				></div>
			</div>
		{:else}
			<div class="flex min-h-0 flex-1 flex-col overflow-auto">
				<div class="w-full px-8 py-10 pl-24 pr-12">
					<!-- Title input -->
					<div class="mb-2">
						<input
							type="text"
							value={title}
							oninput={handleTitleChange}
							placeholder="Wiki Title"
							class="w-full bg-transparent text-4xl font-bold text-black placeholder-zinc-400 outline-none"
						/>
					</div>

					<!-- Wiki metadata -->
					<div class="mb-6 flex items-center gap-2 text-xs text-zinc-400">
						<span class="font-mono">{wikiId}</span>
						<span>·</span>
						<span>
							{#if entry?.updatedAt}
								Last edited {new Date(entry.updatedAt).toLocaleDateString('en-US', {
									month: 'short',
									day: 'numeric',
									year: 'numeric',
									hour: '2-digit',
									minute: '2-digit'
								})}
							{:else if entry?.createdAt}
								Created {new Date(entry.createdAt).toLocaleDateString('en-US', {
									month: 'short',
									day: 'numeric',
									year: 'numeric'
								})}
							{/if}
						</span>
					</div>

					<!-- Blocks -->
					<div class="flex flex-col">
						{#each blocks as block, index (index)}
							<!-- Add block divider -->
							<button
								onclick={() => handleInsertBlock(index)}
								class="group/divider relative flex h-5 w-full items-center justify-center"
							>
								<div class="absolute left-0 right-0 h-px bg-transparent transition-colors group-hover/divider:bg-zinc-300"></div>
								<div class="relative z-10 flex h-4 w-4 items-center justify-center rounded bg-white text-transparent transition-all group-hover/divider:bg-zinc-200 group-hover/divider:text-zinc-500">
									<Plus class="h-2.5 w-2.5" />
								</div>
							</button>

							<!-- Block with number -->
							<div class="relative flex">
								<!-- Block number (always visible) -->
								<div class="absolute -left-8 top-2 w-6 text-right text-xs text-zinc-300">
									{index + 1}
								</div>

								<!-- Block content -->
								<div class="flex-1">
									{#if block.type === 'text'}
										<WikiBlock
											bind:this={blockRefs[index]}
											content={block.content}
											onUpdate={(content) => handleBlockUpdate(index, content)}
											onEnter={() => handleBlockEnter(index)}
											onDelete={() => handleBlockDelete(index)}
											onCreateTask={handleCreateTask}
											onLinkPage={handleLinkPage}
											onLinkProject={handleLinkProject}
										/>
									{:else if block.type === 'task'}
										{@const task = getTask(block.taskId)}
										{#if task}
											<WikiTaskBlock
												{task}
												onEdit={() => handleEditTask(block.taskId)}
												onResolve={() => handleResolveTask(block.taskId)}
											/>
										{:else}
											<!-- Task not found, show placeholder -->
											<div class="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-600">
												Task not found (ID: {block.taskId})
											</div>
										{/if}
									{:else if block.type === 'page'}
										<WikiPageBlock
											pageId={block.pageId}
											onSelect={() => handlePageBlockClick(block.pageId)}
											onDelete={() => handleDeletePageBlock(index)}
										/>
									{:else if block.type === 'project'}
										<WikiProjectBlock
											projectSlug={block.projectSlug}
											onSelect={() => handleProjectBlockClick(block.projectSlug)}
											onDelete={() => handleDeleteProjectBlock(index)}
										/>
									{/if}
								</div>
							</div>
						{/each}

						<!-- Add block divider at the end -->
						<button
							onclick={() => handleInsertBlock(blocks.length)}
							class="group/divider relative flex h-5 w-full items-center justify-center"
						>
							<div class="absolute left-0 right-0 h-px bg-transparent transition-colors group-hover/divider:bg-zinc-300"></div>
							<div class="relative z-10 flex h-4 w-4 items-center justify-center rounded bg-white text-transparent transition-all group-hover/divider:bg-zinc-200 group-hover/divider:text-zinc-500">
								<Plus class="h-2.5 w-2.5" />
							</div>
						</button>
					</div>
				</div>
			</div>
		{/if}
		</div>

		<!-- Sidebars - in the same flex container, under navbar -->
		{#if showTaskSidebar}
			<WikiTaskSidebar
				wikiId={wikiId}
				wikiTitle={title}
				task={editingTask}
				onClose={handleTaskSidebarClose}
				onSave={handleTaskSave}
				onDelete={handleTaskDelete}
			/>
		{:else if showPageSidebar}
			<WikiPageSidebar
				currentWikiId={wikiId}
				onClose={handlePageSidebarClose}
				onSelect={handlePageSelect}
			/>
		{:else if showProjectSidebar}
			<WikiProjectSidebar
				onClose={handleProjectSidebarClose}
				onSelect={handleProjectSelect}
			/>
		{/if}
	</div>
</div>
