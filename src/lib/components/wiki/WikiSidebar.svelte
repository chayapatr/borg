<script lang="ts">
	import { ChevronRight, ChevronLeft, Calendar, Hash, Link2, CheckSquare, Plus, FileText, Folder, ArrowLeft } from '@lucide/svelte';
	import type { WikiEntry } from '../../types/wiki';
	import type { Task } from '../../types/task';
	import WikiTaskSidebar from './WikiTaskSidebar.svelte';
	import WikiPageSidebar from './WikiPageSidebar.svelte';
	import WikiProjectSidebar from './WikiProjectSidebar.svelte';

	interface Props {
		entry: WikiEntry | null;
		isOpen?: boolean;
		onToggle?: () => void;
		// Task panel props
		wikiId: string | null;
		wikiTitle: string;
		editingTask: Task | null;
		onTaskSave?: (task: Task) => void;
		onTaskDelete?: () => void;
		// Page panel props
		currentWikiId: string | null;
		onPageSelect?: (pageId: string) => void;
		// Project panel props
		onProjectSelect?: (projectSlug: string) => void;
	}

	let {
		entry,
		isOpen = true,
		onToggle,
		wikiId,
		wikiTitle,
		editingTask,
		onTaskSave,
		onTaskDelete,
		currentWikiId,
		onPageSelect,
		onProjectSelect
	}: Props = $props();

	type SidebarView = 'info' | 'task' | 'page' | 'project';
	let currentView = $state<SidebarView>('info');

	// Expose method to open panels from parent
	export function openTaskPanel() {
		currentView = 'task';
	}

	export function openPagePanel() {
		currentView = 'page';
	}

	export function openProjectPanel() {
		currentView = 'project';
	}

	// Extract headings from content for table of contents
	let headings = $derived.by(() => {
		if (!entry?.content) return [];
		const lines = entry.content.split('\n');
		const result: { level: number; text: string; id: string }[] = [];

		lines.forEach((line, index) => {
			const h1Match = line.match(/^#\s+(.+)$/);
			const h2Match = line.match(/^##\s+(.+)$/);
			const h3Match = line.match(/^###\s+(.+)$/);

			if (h1Match) {
				result.push({ level: 1, text: h1Match[1], id: `h-${index}` });
			} else if (h2Match) {
				result.push({ level: 2, text: h2Match[1], id: `h-${index}` });
			} else if (h3Match) {
				result.push({ level: 3, text: h3Match[1], id: `h-${index}` });
			}
		});

		return result;
	});

	// Extract linked tasks and pages
	let linkedTasks = $derived.by(() => {
		if (!entry?.content) return [];
		const matches = entry.content.match(/\[\[task:([^\]]+)\]\]/g) || [];
		return matches.map(m => m.match(/\[\[task:([^\]]+)\]\]/)?.[1] || '');
	});

	let linkedPages = $derived.by(() => {
		if (!entry?.content) return [];
		const matches = entry.content.match(/\[\[page:([^\]]+)\]\]/g) || [];
		return matches.map(m => m.match(/\[\[page:([^\]]+)\]\]/)?.[1] || '');
	});

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

{#if isOpen}
	<div class="flex h-full min-h-0 w-72 flex-shrink-0 flex-col overflow-hidden border-l border-zinc-200 bg-white">
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-zinc-200 px-3 py-2">
			{#if currentView !== 'info'}
				<button
					onclick={() => (currentView = 'info')}
					class="flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-800"
				>
					<ArrowLeft class="h-3.5 w-3.5" />
					Back
				</button>
				<span class="text-xs text-zinc-400">
					{currentView === 'task' ? (editingTask ? 'Edit Task' : 'New Task') : currentView === 'page' ? 'Link Page' : 'Link Project'}
				</span>
			{:else}
				<span class="text-xs font-medium text-zinc-600">Page Info</span>
				<button
					onclick={onToggle}
					class="rounded p-0.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
					title="Hide panel"
				>
					<ChevronRight class="h-3.5 w-3.5" />
				</button>
			{/if}
		</div>

		<!-- Content -->
		{#if currentView === 'task'}
			<div class="flex-1 overflow-hidden">
				<WikiTaskSidebar
					{wikiId}
					{wikiTitle}
					task={editingTask}
					onClose={() => {
						currentView = 'info';
					}}
					onSave={(task) => {
						onTaskSave?.(task);
						currentView = 'info';
					}}
					onDelete={() => {
						onTaskDelete?.();
						currentView = 'info';
					}}
				/>
			</div>
		{:else if currentView === 'page'}
			<div class="flex-1 overflow-hidden">
				<WikiPageSidebar
					{currentWikiId}
					onClose={() => {
						currentView = 'info';
					}}
					onSelect={(pageId) => {
						onPageSelect?.(pageId);
						currentView = 'info';
					}}
				/>
			</div>
		{:else if currentView === 'project'}
			<div class="flex-1 overflow-hidden">
				<WikiProjectSidebar
					onClose={() => {
						currentView = 'info';
					}}
					onSelect={(projectSlug) => {
						onProjectSelect?.(projectSlug);
						currentView = 'info';
					}}
				/>
			</div>
		{:else}
			<div class="flex-1 overflow-y-auto p-3 text-xs">
				{#if entry}
					<div class="space-y-4">
						<!-- Quick Actions -->
						<div>
							<div class="mb-1.5 font-medium text-zinc-500">Add to Page</div>
							<div class="space-y-1">
								<button
									onclick={() => (currentView = 'task')}
									class="flex w-full items-center gap-2 rounded border border-zinc-200 bg-borg-beige px-2 py-1.5 text-xs text-black transition-colors hover:bg-black hover:text-white"
								>
									<CheckSquare class="h-3.5 w-3.5" />
									Add Task
								</button>
								<button
									onclick={() => (currentView = 'page')}
									class="flex w-full items-center gap-2 rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 transition-colors hover:bg-zinc-50"
								>
									<FileText class="h-3.5 w-3.5" />
									Link Page
								</button>
								<button
									onclick={() => (currentView = 'project')}
									class="flex w-full items-center gap-2 rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 transition-colors hover:bg-zinc-50"
								>
									<Folder class="h-3.5 w-3.5" />
									Link Project
								</button>
							</div>
						</div>

						<!-- Properties -->
						<div class="space-y-2 border-t border-zinc-100 pt-3">
							<div class="flex items-start gap-2">
								<Calendar class="mt-0.5 h-3 w-3 shrink-0 text-zinc-400" />
								<div class="min-w-0 flex-1">
									<div class="text-zinc-400">Created</div>
									<div class="text-zinc-700">{formatDate(entry.createdAt)}</div>
								</div>
							</div>
							{#if entry.updatedAt && entry.updatedAt !== entry.createdAt}
								<div class="flex items-start gap-2">
									<Calendar class="mt-0.5 h-3 w-3 shrink-0 text-zinc-400" />
									<div class="min-w-0 flex-1">
										<div class="text-zinc-400">Updated</div>
										<div class="text-zinc-700">{formatDate(entry.updatedAt)}</div>
									</div>
								</div>
							{/if}
						</div>

						<!-- Table of Contents -->
						{#if headings.length > 0}
							<div class="border-t border-zinc-100 pt-3">
								<div class="mb-1.5 flex items-center gap-1.5 font-medium text-zinc-500">
									<Hash class="h-3 w-3" />
									Contents
								</div>
								<div class="space-y-1">
									{#each headings as heading}
										<button
											class="block w-full truncate text-left text-zinc-500 transition-colors hover:text-zinc-900"
											style="padding-left: {(heading.level - 1) * 10}px"
										>
											{heading.text}
										</button>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Linked Tasks -->
						{#if linkedTasks.length > 0}
							<div class="border-t border-zinc-100 pt-3">
								<div class="mb-1 flex items-center gap-1.5 font-medium text-zinc-500">
									<CheckSquare class="h-3 w-3" />
									Tasks ({linkedTasks.length})
								</div>
								<div class="text-zinc-400">
									{linkedTasks.length} task{linkedTasks.length > 1 ? 's' : ''} linked
								</div>
							</div>
						{/if}

						<!-- Linked Pages -->
						{#if linkedPages.length > 0}
							<div class="border-t border-zinc-100 pt-3">
								<div class="mb-1 flex items-center gap-1.5 font-medium text-zinc-500">
									<Link2 class="h-3 w-3" />
									Links ({linkedPages.length})
								</div>
								<div class="text-zinc-400">
									{linkedPages.length} page{linkedPages.length > 1 ? 's' : ''} linked
								</div>
							</div>
						{/if}
					</div>
				{:else}
					<div class="py-8 text-center text-zinc-400">
						No page selected
					</div>
				{/if}
			</div>
		{/if}
	</div>
{:else}
	<!-- Small show-panel button on the right edge when sidebar is hidden -->
	<button
		onclick={onToggle}
		class="absolute right-0 top-1/2 z-50 -translate-y-1/2 rounded-l border border-r-0 border-zinc-200 bg-white px-0.5 py-2 text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-600"
		title="Show panel"
	>
		<ChevronLeft class="h-3 w-3" />
	</button>
{/if}
