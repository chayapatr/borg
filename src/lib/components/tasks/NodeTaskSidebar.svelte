<script lang="ts">
	import { X, Plus } from '@lucide/svelte';
	import { ServiceFactory } from '../../services/ServiceFactory';
	import type { ITaskService } from '../../services/interfaces';
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

	const taskService: ITaskService = ServiceFactory.createTaskService();
	
	// Since we removed the completed field, all tasks are considered active
	const activeTasks = $derived(tasks);
</script>

<div class="w-80 border-l border-black bg-white flex flex-col">
	<!-- Sidebar Header -->
	<div class="border-b border-black p-4">
		<div class="flex items-center justify-between">
			<div>
				<h3 class="font-semibold text-black">Node Tasks</h3>
				<p class="text-sm text-zinc-500">{nodeTitle}</p>
			</div>
			<button
				onclick={onClose}
				class="rounded-lg p-1 text-zinc-400 hover:bg-black hover:text-white"
			>
				<X class="h-5 w-5" />
			</button>
		</div>
		<div class="mt-3 flex items-center justify-between">
			<div class="text-sm text-zinc-500">
				{activeTasks.length} active tasks
			</div>
			<button
				onclick={() => {
					const customEvent = new CustomEvent('addTask', {
						detail: { nodeId }
					});
					document.dispatchEvent(customEvent);
				}}
				class="flex items-center gap-1 rounded-lg border border-black bg-borg-beige hover:bg-black hover:text-white px-3 py-1.5 text-xs text-black transition-colors"
			>
				<Plus class="h-3 w-3" />
				Add Task
			</button>
		</div>
	</div>

	<!-- Task List -->
	<div class="flex-1 overflow-auto p-4">
		{#if activeTasks.length === 0}
			<div class="text-center py-8">
				<div class="w-12 h-12 rounded-full bg-zinc-200 flex items-center justify-center mx-auto mb-4">
					<Plus class="h-6 w-6 text-zinc-600" />
				</div>
				<h4 class="text-lg font-medium text-zinc-700 mb-2">No active tasks</h4>
				<p class="text-sm text-zinc-500 mb-4">Add your first task to get started</p>
				<button
					onclick={() => {
						const customEvent = new CustomEvent('addTask', {
							detail: { nodeId }
						});
						document.dispatchEvent(customEvent);
					}}
					class="rounded-lg border border-black bg-borg-beige hover:bg-black hover:text-white px-4 py-2 text-sm text-black transition-colors"
				>
					Add Task
				</button>
			</div>
		{:else}
			<div class="space-y-4">
				<TaskList tasks={activeTasks} {nodeId} {projectSlug} {onTasksUpdated} />
			</div>
		{/if}
	</div>
</div>

