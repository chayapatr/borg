<script lang="ts">
	import { ChevronLeft, CheckSquare } from '@lucide/svelte';
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

<div class="flex h-[calc(100vh-64px)] w-80 flex-col border-l border-black bg-white">
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
			{@const activeTasks = projectTasks.filter((t) => (t.status || 'active') === 'active')}
			{@const resolvedTasks = projectTasks.filter((t) => t.status === 'resolved')}
			<p class="mt-1 text-sm text-zinc-500">
				{activeTasks.length} active, {resolvedTasks.length} resolved
			</p>
		{/if}
	</div>

	<!-- Task List -->
	<div class="flex-1 overflow-auto p-4">
		{#if projectTasks}
			{@const activeTasks = projectTasks.filter((t) => (t.status || 'active') === 'active')}
			{#if activeTasks.length === 0}
				<div class="py-8 text-center">
					<CheckSquare class="mx-auto mb-4 h-12 w-12 text-zinc-600" />
					<h4 class="mb-2 text-lg font-medium text-black">No tasks yet</h4>
					<p class="text-sm text-zinc-500">Add tasks to nodes to track progress</p>
				</div>
			{:else}
				<!-- Group active tasks by node -->
				{@const tasksByNode = activeTasks.reduce(
					(acc: Record<string, typeof activeTasks>, task) => {
						if (!acc[task.nodeId]) {
							acc[task.nodeId] = [];
						}
						acc[task.nodeId].push(task);
						return acc;
					},
					{} as Record<string, typeof activeTasks>
				)}

				<div class="space-y-4">
					{#each Object.entries(tasksByNode) as [nodeId, tasks]}
						{@const nodeTasks = tasks}
						<div class="rounded-lg border border-black bg-borg-beige p-3">
							<div class="mb-3 flex items-center gap-3">
								<h4 class="font-medium text-black">{nodeTasks[0].nodeTitle}</h4>
								<span
									class="rounded-md border border-black bg-white px-2 py-0.5 text-xs font-medium text-black"
								>
									{nodeTasks[0].nodeType}
								</span>
							</div>

							<div class="space-y-2">
								{#each nodeTasks as task}
									{@const person = allPeople.find((p) => p.id === task.assignee)}
									<div class="rounded border border-black bg-white p-3">
										<p class="mb-1 text-sm text-black">
											{task.title}
										</p>
										<p class="text-xs text-zinc-500">
											{person?.name ||
												(task.assignee ? `User ${task.assignee.slice(0, 8)}` : 'Unassigned')}
										</p>
										{#if task.dueDate}
											<p class="text-xs text-zinc-500">
												Due: {new Date(task.dueDate).toLocaleDateString()}
											</p>
										{/if}
										{#if task.notes}
											<p class="mt-1 text-xs text-zinc-500">{task.notes}</p>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{:else}
			<div class="py-8 text-center">
				<CheckSquare class="mx-auto mb-4 h-12 w-12 text-zinc-600" />
				<h4 class="mb-2 text-lg font-medium text-black">No tasks yet</h4>
				<p class="text-sm text-zinc-500">Add tasks to nodes to track progress</p>
			</div>
		{/if}
	</div>
</div>
