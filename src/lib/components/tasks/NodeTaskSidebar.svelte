<script lang="ts">
	import { X, Plus } from '@lucide/svelte';
	import { TaskService } from '../../services/local/TaskService';
	import type { Task } from '../../types/task';
	import TaskList from './TaskList.svelte';

	interface Props {
		nodeId: string;
		nodeTitle: string;
		projectSlug?: string;
		tasks: Task[];
		onClose: () => void;
		onTasksUpdated?: () => void;
	}

	let { nodeId, nodeTitle, projectSlug, tasks, onClose, onTasksUpdated }: Props = $props();

	const taskService = new TaskService();
</script>

<div class="w-80 border-l border-zinc-800 bg-zinc-900 flex flex-col">
	<!-- Sidebar Header -->
	<div class="border-b border-zinc-800 p-4">
		<div class="flex items-center justify-between">
			<div>
				<h3 class="font-semibold text-zinc-100">Node Tasks</h3>
				<p class="text-sm text-zinc-400">{nodeTitle}</p>
			</div>
			<button
				onclick={onClose}
				class="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
			>
				<X class="h-5 w-5" />
			</button>
		</div>
		<div class="mt-3 flex items-center justify-between">
			<div class="text-sm text-zinc-400">
				{tasks.length} tasks
			</div>
			<button
				onclick={() => {
					const customEvent = new CustomEvent('addTask', {
						detail: { nodeId }
					});
					document.dispatchEvent(customEvent);
				}}
				class="flex items-center gap-1 rounded-lg bg-rose-600 hover:bg-rose-700 px-3 py-1.5 text-xs text-white transition-colors"
			>
				<Plus class="h-3 w-3" />
				Add Task
			</button>
		</div>
	</div>

	<!-- Task List -->
	<div class="flex-1 overflow-auto p-4">
		{#if tasks.length === 0}
			<div class="text-center py-8">
				<div class="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
					<Plus class="h-6 w-6 text-zinc-600" />
				</div>
				<h4 class="text-lg font-medium text-zinc-300 mb-2">No tasks yet</h4>
				<p class="text-sm text-zinc-500 mb-4">Add your first task to get started</p>
				<button
					onclick={() => {
						const customEvent = new CustomEvent('addTask', {
							detail: { nodeId }
						});
						document.dispatchEvent(customEvent);
					}}
					class="rounded-lg bg-rose-600 hover:bg-rose-700 px-4 py-2 text-sm text-white transition-colors"
				>
					Add Task
				</button>
			</div>
		{:else}
			<div class="space-y-4">
				<TaskList {tasks} {nodeId} {projectSlug} {onTasksUpdated} />
			</div>
		{/if}
	</div>
</div>

