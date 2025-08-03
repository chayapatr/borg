<script lang="ts">
	import { ChevronLeft, CheckSquare } from '@lucide/svelte';
	import { TaskService } from '../../services/TaskService';
	import { PeopleService } from '../../services/PeopleService';
	import type { TaskWithContext } from '../../types/task';

	interface Props {
		projectSlug: string;
		projectTasks: TaskWithContext[];
		onClose: () => void;
		onTasksUpdated?: () => void;
	}

	let { projectSlug, projectTasks, onClose, onTasksUpdated }: Props = $props();

	const taskService = new TaskService();
	const peopleService = new PeopleService();

	function handleCompleteTask(task: TaskWithContext) {
		taskService.deleteTask(task.nodeId, task.id, projectSlug);
		onTasksUpdated?.();
	}
</script>

<div class="w-80 border-l border-zinc-800 bg-zinc-900 flex flex-col">
	<!-- Sidebar Header -->
	<div class="border-b border-zinc-800 p-4">
		<div class="flex items-center justify-between">
			<h3 class="font-semibold text-zinc-100">Project Tasks</h3>
			<button
				onclick={onClose}
				class="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
			>
				<ChevronLeft class="h-5 w-5" />
			</button>
		</div>
		<p class="mt-1 text-sm text-zinc-400">
			{projectTasks.length} tasks
		</p>
	</div>

	<!-- Task List -->
	<div class="flex-1 overflow-auto p-4">
		{#if projectTasks.length === 0}
			<div class="text-center py-8">
				<CheckSquare class="h-12 w-12 text-zinc-600 mx-auto mb-4" />
				<h4 class="text-lg font-medium text-zinc-300 mb-2">No tasks yet</h4>
				<p class="text-sm text-zinc-500">Add tasks to nodes to track progress</p>
			</div>
		{:else}
			<!-- Group tasks by node -->
			{@const tasksByNode = projectTasks.reduce((acc, task) => {
				if (!acc[task.nodeId]) {
					acc[task.nodeId] = [];
				}
				acc[task.nodeId].push(task);
				return acc;
			}, {})}

			<div class="space-y-4">
				{#each Object.entries(tasksByNode) as [nodeId, tasks]}
					{@const nodeTasks = tasks}
					<div class="rounded-lg border border-zinc-800 bg-zinc-800/50 p-3">
						<h4 class="font-medium text-zinc-200 mb-3">{nodeTasks[0].nodeTitle}</h4>
						
						<div class="space-y-2">
							{#each nodeTasks as task}
								{@const person = peopleService.getPerson(task.assignee)}
								<div class="flex items-start gap-2 rounded bg-zinc-900/50 p-2">
									<button
										onclick={() => handleCompleteTask(task)}
										class="mt-0.5 rounded-full border-2 border-zinc-600 hover:border-green-500 p-1 transition-colors"
										title="Mark as complete (delete)"
									>
										<div class="h-3 w-3"></div>
									</button>
									<div class="flex-1 min-w-0">
										<p class="text-sm text-zinc-200">{task.title}</p>
										<p class="text-xs text-zinc-500">{person?.name || 'Unknown'}</p>
										{#if task.dueDate}
											<p class="text-xs text-zinc-500">Due: {new Date(task.dueDate).toLocaleDateString()}</p>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>