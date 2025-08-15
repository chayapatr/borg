<script lang="ts">
	import { Calendar, StickyNote, Edit, Check, RotateCcw, Trash2 } from '@lucide/svelte';
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
		try {
			console.log('TaskList: Starting to resolve task', { taskId, nodeId, projectSlug });
			const result = taskService.resolveTask(nodeId, taskId, projectSlug);
			if (result instanceof Promise) await result;
			console.log('TaskList: Task resolved successfully, calling onTasksUpdated');
			onTasksUpdated?.();
			console.log('TaskList: onTasksUpdated called');
		} catch (error) {
			console.error('Failed to resolve task:', error);
			alert('Failed to resolve task. Please try again.');
		}
	}

	async function handleReactivateTask(taskId: string) {
		try {
			const result = taskService.updateTask(
				nodeId,
				taskId,
				{ status: 'active' } as Partial<Task>,
				projectSlug
			);
			if (result instanceof Promise) await result;
			onTasksUpdated?.();
		} catch (error) {
			console.error('Failed to reactivate task:', error);
			alert('Failed to reactivate task. Please try again.');
		}
	}

	async function handleDeleteTask(taskId: string) {
		if (confirm('Are you sure you want to permanently delete this task?')) {
			try {
				const result = taskService.deleteTask(nodeId, taskId, projectSlug);
				if (result instanceof Promise) await result;
				onTasksUpdated?.();
			} catch (error) {
				console.error('Failed to delete task:', error);
				alert('Failed to delete task. Please try again.');
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

		{@const isResolved = task.status === 'resolved'}
		<div
			class="group flex items-start gap-2 rounded-lg border border-black bg-borg-beige p-3 {isResolved
				? 'opacity-75'
				: ''}"
		>
			{#if isResolved}
				<button
					onclick={() => handleReactivateTask(task.id)}
					class="mt-0.5 rounded-full border border-black p-1 transition-all duration-200 hover:border-black hover:bg-orange-400"
					title="Reactivate task"
				>
					<RotateCcw class="h-3 w-3" />
				</button>
			{:else}
				<button
					onclick={() => handleResolveTask(task.id)}
					class="mt-0.5 rounded-full border border-black p-1 transition-all duration-200 hover:border-black hover:bg-green-400"
					title="Mark as resolved"
				>
					<Check class="h-3 w-3" />
				</button>
			{/if}

			<div class="min-w-0 flex-1">
				<div class="flex items-start justify-between gap-2">
					<p class="text-sm text-black {isResolved ? 'line-through' : ''}">
						{task.title}
					</p>
					<div class="flex items-center gap-1">
						<div
							class="ml-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
						>
							<button
								onclick={() => handleDeleteTask(task.id)}
								class="rounded p-1 text-zinc-500 hover:bg-zinc-200 hover:text-borg-orange"
								title="Delete permanently"
							>
								<Trash2 class="h-3 w-3" />
							</button>
							<button
								onclick={() => handleEditTask(task)}
								class="rounded p-1 text-zinc-500 hover:bg-zinc-200 hover:text-borg-blue"
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
						<!-- <StickyNote class="mt-0.5 h-3 w-3 flex-shrink-0" /> -->
						<span class="break-words">{task.notes}</span>
					</div>
				{/if}

				{#if isResolved}
					<div class="mt-1 flex items-center gap-1 text-xs text-green-600">
						<Check class="h-3 w-3" />
						<span>Resolved</span>
					</div>
				{/if}

				<div class="mt-2 mb-1 flex items-center gap-2 text-xs whitespace-nowrap text-black">
					{#if person?.name}
						<img src={person.photoUrl} alt="" class="h-4 w-4 rounded-full" />
					{/if}
					{person?.name || (task.assignee ? `User ${task.assignee.slice(0, 8)}` : 'Unassigned')}
				</div>
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
