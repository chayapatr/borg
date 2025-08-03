<script lang="ts">
	import { ChevronLeft, CheckSquare } from '@lucide/svelte';
	import { PeopleService } from '../../services/PeopleService';
	import type { TaskWithContext } from '../../types/task';

	interface Props {
		projectSlug: string;
		projectTasks: TaskWithContext[];
		onClose: () => void;
	}

	let { projectSlug, projectTasks, onClose }: Props = $props();

	const peopleService = new PeopleService();

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
						<div class="flex items-center gap-3 mb-3">
							<h4 class="font-medium text-zinc-200">{nodeTasks[0].nodeTitle}</h4>
							<span class="rounded-md border border-zinc-600 bg-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-300">
								{nodeTasks[0].nodeType}
							</span>
						</div>
						
						<div class="space-y-2">
							{#each nodeTasks as task}
								{@const person = peopleService.getPerson(task.assignee)}
								<div class="rounded bg-zinc-900/50 p-3">
									<p class="text-sm text-zinc-200 mb-1">{task.title}</p>
									<p class="text-xs text-zinc-500">{person?.name || 'Unknown'}</p>
									{#if task.dueDate}
										<p class="text-xs text-zinc-500">Due: {new Date(task.dueDate).toLocaleDateString()}</p>
									{/if}
									{#if task.notes}
										<p class="text-xs text-zinc-500 mt-1">{task.notes}</p>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>