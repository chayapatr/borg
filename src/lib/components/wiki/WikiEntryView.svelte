<script lang="ts">
	import { onMount } from 'svelte';
	import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
	import { app } from '$lib/firebase/config';
	import { compressImageFile } from '$lib/utils/resizeImage';
	import { ServiceFactory } from '$lib/services/ServiceFactory';
	import type { IWikiService } from '$lib/services/interfaces/IWikiService';
	import type { ITaskService } from '$lib/services/interfaces/ITaskService';
	import type { WikiEntry } from '$lib/types/wiki';
	import type { Task } from '$lib/types/task';
	import { Plus } from '@lucide/svelte';
	import WikiBlock from './WikiBlock.svelte';
	import WikiTaskBlock from './WikiTaskBlock.svelte';
	import WikiPageBlock from './WikiPageBlock.svelte';
	import WikiProjectBlock from './WikiProjectBlock.svelte';
	import WikiImageBlock from './WikiImageBlock.svelte';
	import WikiSidebar from './WikiSidebar.svelte';

	interface Props {
		wikiId: string;
		onNavigatePage?: (pageId: string) => void;
	}

	let { wikiId, onNavigatePage }: Props = $props();

	// Block types
	interface TextBlock { type: 'text'; content: string; id: string; }
	interface TaskBlock { type: 'task'; taskId: string; id: string; }
	interface PageBlock { type: 'page'; pageId: string; id: string; }
	interface ProjectBlock { type: 'project'; projectSlug: string; id: string; }
	interface ImageBlock { type: 'image'; imageUrl: string; id: string; }
	type Block = TextBlock | TaskBlock | PageBlock | ProjectBlock | ImageBlock;

	let _blockIdCounter = 0;
	function newBlockId() { return `b${++_blockIdCounter}`; }

	let wikiService: IWikiService;
	let taskService: ITaskService;
	let entry = $state<WikiEntry | null>(null);
	let loading = $state(true);
	let saving = $state(false);
	let subscriptionCleanup: (() => void) | null = null;

	let title = $state('');
	let blocks = $state<Block[]>([{ type: 'text', content: '', id: newBlockId() }]);
	let hasChanges = $state(false);

	let tasksMap = $state<Map<string, Task>>(new Map());
	let taskSubscriptionCleanup: (() => void) | null = null;

	let sidebarOpen = $state(true);
	let editingTask = $state<Task | null>(null);
	let pendingTaskBlockIndex = $state<number | null>(null);
	let sidebarRef = $state<WikiSidebar | null>(null);

	let blockRefs: Record<string, WikiBlock | null> = $state({});
	let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

	// Drag-and-drop state
	let isDragOver = $state(false);
	let isUploadingDrop = $state(false);

	// Hidden file input for /image command
	let imageFileInput: HTMLInputElement | null = $state(null);
	let imageInsertAfterBlockId: string | null = null;

	function contentToBlocks(content: string): Block[] {
		if (!content) return [{ type: 'text', content: '', id: newBlockId() }];
		const lines = content.split(/\n\n+/);
		const result: Block[] = [];
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			const imageMatch = trimmed.match(/^\[\[image:(https?:\/\/[^\]]+)\]\]$/);
			if (imageMatch) {
				result.push({ type: 'image', imageUrl: imageMatch[1], id: newBlockId() });
			} else {
				result.push({ type: 'text', content: trimmed, id: newBlockId() });
			}
		}
		const meaningful = result.length > 0 ? result : [{ type: 'text', content: '', id: newBlockId() }];
		return [...meaningful, { type: 'text', content: '', id: newBlockId() }];
	}

	function blocksToContent(blocks: Block[]): string {
		return blocks
			.map((block) => {
				if (block.type === 'task') return `[[task:${block.taskId}]]`;
				if (block.type === 'page') return `[[page:${block.pageId}]]`;
				if (block.type === 'project') return `[[project:${block.projectSlug}]]`;
				if (block.type === 'image') return `[[image:${block.imageUrl}]]`;
				return block.content;
			})
			.filter((s) => s.trim() !== '')
			.join('\n\n');
	}

	function getTask(taskId: string): Task | undefined {
		return tasksMap.get(taskId);
	}

	// Reload when wikiId prop changes
	$effect(() => {
		if (wikiId && wikiService && taskService) {
			cleanup();
			loadEntry();
			loadTasks();
		}
	});

	onMount(() => {
		wikiService = ServiceFactory.createWikiService();
		taskService = ServiceFactory.createTaskService();
		loadEntry();
		loadTasks();

		(window as any).__navigateToPage = (pageId: string) => {
			if (onNavigatePage) {
				onNavigatePage(pageId);
			} else {
				window.open(`/wiki/${pageId}`, '_blank');
			}
		};
		(window as any).__navigateToProject = (projectSlug: string) => {
			window.open(`/project/${projectSlug}`, '_blank');
		};
		(window as any).__getTask = (taskId: string) => getTask(taskId);
		(window as any).__editTask = (taskId: string) => handleEditTask(taskId);
		(window as any).__toggleTask = async (taskId: string) => {
			const task = getTask(taskId);
			if (task) {
				if (task.status === 'resolved') {
					await taskService.updateTask(wikiId, taskId, { status: 'active' });
					tasksMap.set(taskId, { ...task, status: 'active' });
					tasksMap = new Map(tasksMap);
				} else {
					await handleResolveTask(taskId);
				}
			}
		};

		return () => {
			cleanup();
			delete (window as any).__navigateToPage;
			delete (window as any).__navigateToProject;
			delete (window as any).__getTask;
			delete (window as any).__editTask;
			delete (window as any).__toggleTask;
		};
	});

	function cleanup() {
		if (subscriptionCleanup) { subscriptionCleanup(); subscriptionCleanup = null; }
		if (taskSubscriptionCleanup) { taskSubscriptionCleanup(); taskSubscriptionCleanup = null; }
		if (autosaveTimer) { clearTimeout(autosaveTimer); autosaveTimer = null; }
	}

	async function loadEntry() {
		loading = true;
		if ((wikiService as any).subscribeToEntry) {
			subscriptionCleanup = (wikiService as any).subscribeToEntry(
				wikiId,
				(updatedEntry: WikiEntry | null) => {
					if (updatedEntry) {
						entry = updatedEntry;
						if (!hasChanges) {
							title = updatedEntry.title;
							blocks = contentToBlocks(updatedEntry.content);
						}
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
			}
			loading = false;
		}
	}

	async function loadTasks() {
		if (taskService.subscribeToNodeTasks) {
			taskSubscriptionCleanup = taskService.subscribeToNodeTasks(
				wikiId,
				(updatedTasks) => {
					tasksMap = new Map(updatedTasks.map((t) => [t.id, t]));
				},
				undefined,
				true
			);
		} else {
			const result = taskService.getNodeTasks(wikiId);
			const tasksList = result instanceof Promise ? await result : result;
			tasksMap = new Map(tasksList.map((t) => [t.id, t]));
		}
	}

	function handleTitleChange(e: Event) {
		title = (e.target as HTMLInputElement).value;
		hasChanges = true;
		scheduleAutosave();
	}

	function handleBlockUpdate(blockId: string, content: string) {
		const block = blocks.find((b) => b.id === blockId);
		if (block && block.type === 'text') {
			block.content = content;
			blocks = [...blocks];
			hasChanges = true;
			scheduleAutosave();
		}
	}

	function handleBlockEnter(blockId: string) {
		const index = blocks.findIndex((b) => b.id === blockId);
		if (index === -1) return;
		const newId = newBlockId();
		blocks = [
			...blocks.slice(0, index + 1),
			{ type: 'text', content: '', id: newId },
			...blocks.slice(index + 1)
		];
		hasChanges = true;
		scheduleAutosave();
		requestAnimationFrame(() => {
			blockRefs[newId]?.focus();
		});
	}

	function handleInsertBlock(blockId: string) {
		const index = blocks.findIndex((b) => b.id === blockId);
		if (index === -1) return;
		const newId = newBlockId();
		blocks = [
			...blocks.slice(0, index),
			{ type: 'text', content: '', id: newId },
			...blocks.slice(index)
		];
		hasChanges = true;
		scheduleAutosave();
		requestAnimationFrame(() => {
			blockRefs[newId]?.focus();
		});
	}

	function handleBlockDelete(blockId: string) {
		const index = blocks.findIndex((b) => b.id === blockId);
		if (index === -1) return;
		const block = blocks[index];
		// Don't delete the trailing empty block
		if (block.type === 'text' && block.content === '' && index === blocks.length - 1) return;
		if (block.type === 'task') {
			taskService.deleteTask(wikiId, block.taskId);
		}
		const prevBlock = blocks[Math.max(0, index - 1)];
		const newBlocks = [...blocks.slice(0, index), ...blocks.slice(index + 1)];
		// Always keep at least one trailing empty block
		const last = newBlocks[newBlocks.length - 1];
		if (!last || last.type !== 'text' || last.content !== '') {
			newBlocks.push({ type: 'text', content: '', id: newBlockId() });
		}
		blocks = newBlocks;
		hasChanges = true;
		scheduleAutosave();
		requestAnimationFrame(() => {
			if (prevBlock && prevBlock.type === 'text') {
				blockRefs[prevBlock.id]?.focus();
			}
		});
	}

	function handleDeletePageBlock(blockId: string) {
		const index = blocks.findIndex((b) => b.id === blockId);
		if (index === -1) return;
		blocks = [...blocks.slice(0, index), ...blocks.slice(index + 1)];
		if (blocks.length === 0) blocks = [{ type: 'text', content: '', id: newBlockId() }];
		hasChanges = true;
		scheduleAutosave();
	}

	function handleDeleteProjectBlock(blockId: string) {
		const index = blocks.findIndex((b) => b.id === blockId);
		if (index === -1) return;
		blocks = [...blocks.slice(0, index), ...blocks.slice(index + 1)];
		if (blocks.length === 0) blocks = [{ type: 'text', content: '', id: newBlockId() }];
		hasChanges = true;
		scheduleAutosave();
	}

	function handleDeleteImageBlock(blockId: string) {
		const index = blocks.findIndex((b) => b.id === blockId);
		if (index === -1) return;
		blocks = [...blocks.slice(0, index), ...blocks.slice(index + 1)];
		if (blocks.length === 0) blocks = [{ type: 'text', content: '', id: newBlockId() }];
		hasChanges = true;
		scheduleAutosave();
	}

	// ── Image upload ─────────────────────────────────────────────────────────

	async function uploadImageFile(file: File): Promise<string> {
		const compressed = await compressImageFile(file);
		const storage = getStorage(app);
		const timestamp = Date.now();
		const storageRef = ref(storage, `wiki-images/${timestamp}_${file.name}`);
		const snapshot = await uploadBytes(storageRef, compressed);
		return await getDownloadURL(snapshot.ref);
	}

	function insertImageBlock(imageUrl: string, afterBlockId: string | null) {
		const newId = newBlockId();
		const imageBlock: ImageBlock = { type: 'image', imageUrl, id: newId };
		const trailingText: TextBlock = { type: 'text', content: '', id: newBlockId() };

		if (afterBlockId === null) {
			// Insert before trailing empty, or at end
			const lastIdx = blocks.length - 1;
			const last = blocks[lastIdx];
			if (last?.type === 'text' && last.content === '') {
				blocks = [...blocks.slice(0, lastIdx), imageBlock, trailingText];
			} else {
				blocks = [...blocks, imageBlock, trailingText];
			}
		} else {
			const idx = blocks.findIndex((b) => b.id === afterBlockId);
			if (idx === -1) {
				blocks = [...blocks, imageBlock, trailingText];
			} else {
				blocks = [...blocks.slice(0, idx + 1), imageBlock, trailingText, ...blocks.slice(idx + 1)];
			}
		}
		hasChanges = true;
		scheduleAutosave();
	}

	// Called from WikiBlock /image command
	function handleInsertImage(afterBlockId: string) {
		imageInsertAfterBlockId = afterBlockId;
		imageFileInput?.click();
	}

	async function handleImageFileSelected(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		target.value = '';
		if (!file || !file.type.startsWith('image/')) return;
		try {
			const url = await uploadImageFile(file);
			insertImageBlock(url, imageInsertAfterBlockId);
		} catch (err) {
			console.error('Image upload failed', err);
		}
		imageInsertAfterBlockId = null;
	}

	// ── Page-level drag-and-drop ─────────────────────────────────────────────

	function handlePageDragOver(e: DragEvent) {
		if (!e.dataTransfer?.types.includes('Files')) return;
		e.preventDefault();
		isDragOver = true;
	}

	function handlePageDragLeave(e: DragEvent) {
		// Only clear if leaving the entire page area (relatedTarget is null or outside)
		if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
			isDragOver = false;
		}
	}

	async function handlePageDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
		const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
		if (files.length === 0) return;
		isUploadingDrop = true;
		try {
			for (const file of files) {
				const url = await uploadImageFile(file);
				insertImageBlock(url, null);
			}
		} catch (err) {
			console.error('Drop upload failed', err);
		}
		isUploadingDrop = false;
	}

	// ── Task / page / project handlers ───────────────────────────────────────

	function handleCreateTask(callback: (taskId: string) => void) {
		(window as any).__taskCreateCallback = callback;
		pendingTaskBlockIndex = null;
		editingTask = null;
		sidebarRef?.openTaskPanel();
	}

	function handleEditTask(taskId: string) {
		const task = getTask(taskId);
		if (task) {
			editingTask = task;
			sidebarRef?.openTaskPanel();
		}
	}

	async function handleResolveTask(taskId: string) {
		await taskService.resolveTask(wikiId, taskId);
		const task = tasksMap.get(taskId);
		if (task) {
			tasksMap.set(taskId, { ...task, status: 'resolved' });
			tasksMap = new Map(tasksMap);
		}
	}

	function handleTaskSidebarClose() {
		editingTask = null;
		pendingTaskBlockIndex = null;
		delete (window as any).__taskCreateCallback;
	}

	async function handleTaskSave(task: Task) {
		tasksMap.set(task.id, task);
		tasksMap = new Map(tasksMap);
		const callback = (window as any).__taskCreateCallback;
		if (callback) callback(task.id);
		if (pendingTaskBlockIndex !== null) {
			blocks = [
				...blocks.slice(0, pendingTaskBlockIndex),
				{ type: 'task', taskId: task.id, id: newBlockId() },
				{ type: 'text', content: '', id: newBlockId() },
				...blocks.slice(pendingTaskBlockIndex + 1)
			];
			hasChanges = true;
			scheduleAutosave();
		}
		handleTaskSidebarClose();
	}

	async function handleTaskDelete() {
		if (editingTask) {
			tasksMap.delete(editingTask.id);
			tasksMap = new Map(tasksMap);
			const taskBlockIndex = blocks.findIndex(
				(b) => b.type === 'task' && b.taskId === editingTask!.id
			);
			if (taskBlockIndex !== -1) {
				blocks = [...blocks.slice(0, taskBlockIndex), ...blocks.slice(taskBlockIndex + 1)];
				if (blocks.length === 0) blocks = [{ type: 'text', content: '', id: newBlockId() }];
				hasChanges = true;
				scheduleAutosave();
			}
		}
		handleTaskSidebarClose();
	}

	function handleLinkPage(callback: (pageId: string) => void) {
		(window as any).__pageLinkCallback = callback;
		sidebarRef?.openPagePanel();
	}

	function handlePageSidebarClose() {
		delete (window as any).__pageLinkCallback;
	}

	function handlePageSelect(pageId: string) {
		const callback = (window as any).__pageLinkCallback;
		if (callback) callback(pageId);
		handlePageSidebarClose();
	}

	function handlePageBlockClick(pageId: string) {
		if (onNavigatePage) {
			onNavigatePage(pageId);
		} else {
			window.open(`/wiki/${pageId}`, '_blank');
		}
	}

	function handleLinkProject(callback: (projectSlug: string) => void) {
		(window as any).__projectLinkCallback = callback;
		sidebarRef?.openProjectPanel();
	}

	function handleProjectSidebarClose() {
		delete (window as any).__projectLinkCallback;
	}

	function handleProjectSelect(projectSlug: string) {
		const callback = (window as any).__projectLinkCallback;
		if (callback) callback(projectSlug);
		handleProjectSidebarClose();
	}

	function handleProjectBlockClick(projectSlug: string) {
		window.open(`/project/${projectSlug}`, '_blank');
	}

	function scheduleAutosave() {
		if (autosaveTimer) clearTimeout(autosaveTimer);
		autosaveTimer = setTimeout(() => save(), 1000);
	}

	async function save() {
		if (!hasChanges || saving) return;
		saving = true;
		await wikiService.updateEntry(wikiId, {
			title,
			content: blocksToContent(blocks)
		});
		hasChanges = false;
		saving = false;
	}

	export async function handleSave() {
		if (autosaveTimer) clearTimeout(autosaveTimer);
		await save();
	}

	export function getSaveState() {
		return { saving, hasChanges };
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			handleSave();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Hidden file input for /image command -->
<input
	bind:this={imageFileInput}
	type="file"
	accept="image/*"
	class="hidden"
	onchange={handleImageFileSelected}
/>

<div
	class="flex min-h-0 flex-1 relative"
	ondragover={handlePageDragOver}
	ondragleave={handlePageDragLeave}
	ondrop={handlePageDrop}
	role="region"
	aria-label="Wiki page"
>
	<!-- Drag-over overlay -->
	{#if isDragOver || isUploadingDrop}
		<div class="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-black bg-black/5">
			<div class="flex flex-col items-center gap-2 text-sm font-medium text-black">
				{#if isUploadingDrop}
					<div class="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent"></div>
					<span>Uploading...</span>
				{:else}
					<span>Drop image to insert</span>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Main content -->
	<div class="flex flex-1 flex-col overflow-hidden">
		{#if loading}
			<div class="flex flex-1 items-center justify-center">
				<div class="h-8 w-8 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent"></div>
			</div>
		{:else}
			<div class="flex min-h-0 flex-1 flex-col overflow-auto">
				<!-- Centered content, Notion-style -->
				<div class="mx-auto w-full max-w-2xl px-6 py-10">
					<!-- Title -->
					<div class="mb-1">
						<input
							type="text"
							value={title}
							oninput={handleTitleChange}
							placeholder="Untitled"
							class="w-full bg-transparent text-2xl font-bold text-black placeholder-zinc-300 outline-none"
						/>
					</div>

					<!-- Metadata -->
					<div class="mb-6 flex items-center gap-2 text-xs text-zinc-400">
						{#if entry?.updatedAt}
							Last edited {new Date(entry.updatedAt).toLocaleDateString('en-US', {
								month: 'short', day: 'numeric', year: 'numeric',
								hour: '2-digit', minute: '2-digit'
							})}
						{:else if entry?.createdAt}
							Created {new Date(entry.createdAt).toLocaleDateString('en-US', {
								month: 'short', day: 'numeric', year: 'numeric'
							})}
						{/if}
					</div>

					<!-- Blocks -->
					<div class="flex flex-col">
						{#each blocks as block, index (block.id)}
							<div class="group/block relative">
								<!-- Divider with insert button -->
								<div class="relative flex h-6 items-center">
									<div class="h-px w-full bg-transparent transition-colors group-hover/block:bg-zinc-100"></div>
									<button
										onclick={() => handleInsertBlock(block.id)}
										class="absolute left-1/2 z-10 hidden h-5 w-5 -translate-x-1/2 items-center justify-center rounded bg-white text-zinc-400 ring-1 ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-600 group-hover/block:flex"
										tabindex="-1"
									>
										<Plus class="h-3 w-3" />
									</button>
								</div>

								{#if block.type === 'text'}
									<WikiBlock
										bind:this={blockRefs[block.id]}
										content={block.content}
										onUpdate={(content) => handleBlockUpdate(block.id, content)}
										onEnter={() => handleBlockEnter(block.id)}
										onDelete={() => handleBlockDelete(block.id)}
										onCreateTask={handleCreateTask}
										onLinkPage={handleLinkPage}
										onLinkProject={handleLinkProject}
										onInsertImage={() => handleInsertImage(block.id)}
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
										<div class="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-500">
											Task not found
										</div>
									{/if}
								{:else if block.type === 'page'}
									<WikiPageBlock
										pageId={block.pageId}
										onSelect={() => handlePageBlockClick(block.pageId)}
										onDelete={() => handleDeletePageBlock(block.id)}
									/>
								{:else if block.type === 'project'}
									<WikiProjectBlock
										projectSlug={block.projectSlug}
										onSelect={() => handleProjectBlockClick(block.projectSlug)}
										onDelete={() => handleDeleteProjectBlock(block.id)}
									/>
								{:else if block.type === 'image'}
									<WikiImageBlock
										imageUrl={block.imageUrl}
										onDelete={() => handleDeleteImageBlock(block.id)}
									/>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Sidebar -->
	<WikiSidebar
		bind:this={sidebarRef}
		{entry}
		isOpen={sidebarOpen}
		onToggle={() => (sidebarOpen = !sidebarOpen)}
		wikiId={wikiId}
		wikiTitle={title}
		{editingTask}
		onTaskSave={handleTaskSave}
		onTaskDelete={handleTaskDelete}
		currentWikiId={wikiId}
		onPageSelect={handlePageSelect}
		onProjectSelect={handleProjectSelect}
	/>
</div>
