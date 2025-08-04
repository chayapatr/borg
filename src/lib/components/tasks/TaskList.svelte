<script lang="ts">
	import { Calendar, StickyNote, Edit, Check } from '@lucide/svelte';
	import type { Task } from '../../types/task';
	import { ServiceFactory } from '../../services/ServiceFactory';
	import type { IPeopleService, ITaskService } from '../../services/interfaces';
	import TaskModal from './TaskModal.svelte';

	interface Props {
		tasks: Task[];
		nodeId: string;
		projectSlug?: string;
		onTasksUpdated?: () => void;
	}

	let { tasks, nodeId, projectSlug, onTasksUpdated }: Props = $props();

	const peopleService: IPeopleService = ServiceFactory.createPeopleService();
	const taskService: ITaskService = ServiceFactory.createTaskService();

	let editingTask = $state<Task | null>(null);
	let allPeople = $state<any[]>([]);

	// Load all people once for efficient lookup
	$effect(() => {
		(async () => {
			const result = peopleService.getAllPeople();
			allPeople = result instanceof Promise ? await result : result;
		})();
	});

	async function handleResolveTask(taskId: string) {
		if (confirm('Are you sure you want to resolve (delete) this task?')) {
			try {
				console.log('Resolving task:', { taskId, nodeId, projectSlug });
				const result = taskService.deleteTask(nodeId, taskId, projectSlug);
				if (result instanceof Promise) await result;
				onTasksUpdated?.();
			} catch (error) {
				console.error('Failed to resolve task:', error);
				alert('Failed to resolve task. Please try again.');
			}
		}
	}

	function handleEditTask(task: Task) {
		editingTask = task;
	}

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString();
	}

	function isOverdue(dueDate: string) {
		return new Date(dueDate) < new Date();
	}
</script>

<div class="space-y-2">
	{#each tasks as task}
		{@const person = allPeople.find((p) => p.id === task.assignee)}
		{@const overdue = task.dueDate && isOverdue(task.dueDate)}

		<div class="group flex items-start gap-2 rounded-lg border border-black bg-borg-beige p-3">
			<button
				onclick={() => handleResolveTask(task.id)}
				class="mt-0.5 rounded-full border border-black p-1 transition-all duration-200 hover:border-black hover:bg-green-400"
				title="Resolve task (delete)"
			>
				<Check class="h-3 w-3" />
			</button>

			<div class="min-w-0 flex-1">
				<div class="flex items-start justify-between gap-2">
					<p class="text-sm text-black">{task.title}</p>
					<div class="flex items-center gap-1">
						<span class="text-xs whitespace-nowrap text-zinc-600">
							{person?.name || (task.assignee ? `User ${task.assignee.slice(0, 8)}` : 'Unassigned')}
						</span>
						<div
							class="ml-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
						>
							<button
								onclick={() => handleEditTask(task)}
								class="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-blue-400"
								title="Edit task"
							>
								<Edit class="h-3 w-3" />
							</button>
						</div>
					</div>
				</div>

				{#if task.dueDate}
					<div
						class="mt-1 flex items-center gap-1 text-xs {overdue
							? 'text-rose-400'
							: 'text-zinc-500'}"
					>
						<Calendar class="h-3 w-3" />
						<span>Due {formatDate(task.dueDate)}</span>
						{#if overdue}
							<span class="text-rose-400">(Overdue)</span>
						{/if}
					</div>
				{/if}

				{#if task.notes}
					<div class="mt-1 flex items-start gap-1 text-xs text-zinc-500">
						<StickyNote class="mt-0.5 h-3 w-3 flex-shrink-0" />
						<span class="break-words">{task.notes}</span>
					</div>
				{/if}
			</div>
		</div>
	{/each}
</div>

<!-- Task Modal -->
{#if editingTask}
	<TaskModal
		task={editingTask}
		{nodeId}
		{projectSlug}
		onClose={() => (editingTask = null)}
		onTaskUpdated={() => {
			editingTask = null;
			onTasksUpdated?.();
		}}
	/>
{/if}
