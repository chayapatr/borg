<script lang="ts">
	import { ChevronLeft, CheckSquare, Check } from '@lucide/svelte';
	import { ServiceFactory } from '../../services/ServiceFactory';
	import type { IPeopleService } from '../../services/interfaces';
	import type { TaskWithContext } from '../../types/task';

	interface Props {
		projectSlug: string;
		projectTasks: TaskWithContext[];
		onClose: () => void;
	}

	let { projectSlug, projectTasks, onClose }: Props = $props();

	const peopleService = ServiceFactory.createPeopleService();
	let allPeople = $state<any[]>([]);

	// Load all people once for efficient lookup
	$effect(() => {
		(async () => {
			const result = peopleService.getAllPeople();
			allPeople = result instanceof Promise ? await result : result;
		})();
	});

</script>

<div class="w-80 border-l border-black bg-white flex flex-col">
	<!-- Sidebar Header -->
	<div class="border-b border-black p-4">
		<div class="flex items-center justify-between">
			<h3 class="font-semibold text-black">Project Tasks</h3>
			<button
				onclick={onClose}
				class="rounded-lg p-1 text-zinc-400 hover:bg-black hover:text-white"
			>
				<ChevronLeft class="h-5 w-5" />
			</button>
		</div>
		{#if projectTasks}
			{@const activeTasks = projectTasks.filter(t => (t.status || 'active') === 'active')}
			{@const resolvedTasks = projectTasks.filter(t => t.status === 'resolved')}
			<p class="mt-1 text-sm text-zinc-500">
				{activeTasks.length} active, {resolvedTasks.length} resolved
			</p>
		{/if}
	</div>

	<!-- Task List -->
	<div class="flex-1 overflow-auto p-4">
		{#if projectTasks.length === 0}
			<div class="text-center py-8">
				<CheckSquare class="h-12 w-12 text-zinc-600 mx-auto mb-4" />
				<h4 class="text-lg font-medium text-zinc-700 mb-2">No tasks yet</h4>
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
					<div class="rounded-lg border border-black bg-borg-beige p-3">
						<div class="flex items-center gap-3 mb-3">
							<h4 class="font-medium text-zinc-700">{nodeTasks[0].nodeTitle}</h4>
							<span class="rounded-md border border-black bg-borg-beige px-2 py-0.5 text-xs font-medium text-zinc-700">
								{nodeTasks[0].nodeType}
							</span>
						</div>
						
						<div class="space-y-2">
							{#each nodeTasks as task}
								{@const person = allPeople.find(p => p.id === task.assignee)}
								{@const isResolved = task.status === 'resolved'}
								<div class="rounded border border-black bg-borg-beige p-3 {isResolved ? 'opacity-75' : ''}">
									<p class="text-sm text-zinc-700 mb-1 {isResolved ? 'line-through' : ''}">{task.title}</p>
									<p class="text-xs text-zinc-500">{person?.name || (task.assignee ? `User ${task.assignee.slice(0, 8)}` : 'Unassigned')}</p>
									{#if task.dueDate}
										<p class="text-xs text-zinc-500">Due: {new Date(task.dueDate).toLocaleDateString()}</p>
									{/if}
									{#if task.notes}
										<p class="text-xs text-zinc-500 mt-1">{task.notes}</p>
									{/if}
									{#if isResolved}
										<div class="mt-1 flex items-center gap-1 text-xs text-green-600">
											<Check class="h-3 w-3" />
											<span>Resolved</span>
										</div>
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