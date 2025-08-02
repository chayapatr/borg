<script lang="ts">
	import { Check, Calendar, StickyNote, Edit, Trash2, RotateCcw } from '@lucide/svelte';
	import type { Task } from '../../types/task';
	import { PeopleService } from '../../services/PeopleService';
	import { TaskService } from '../../services/TaskService';
	import EditTaskModal from './EditTaskModal.svelte';

	interface Props {
		tasks: Task[];
		nodeId: string;
		projectSlug?: string;
		onTasksUpdated?: () => void;
	}

	let { tasks, nodeId, projectSlug, onTasksUpdated }: Props = $props();

	const peopleService = new PeopleService();
	const taskService = new TaskService();
	
	let editingTask = $state<Task | null>(null);

	function handleResolveTask(taskId: string) {
		taskService.resolveTask(nodeId, taskId, projectSlug);
		onTasksUpdated?.();
	}

	function handleUnresolveTask(taskId: string) {
		taskService.unresolveTask(nodeId, taskId, projectSlug);
		onTasksUpdated?.();
	}

	function handleDeleteTask(taskId: string) {
		if (confirm('Are you sure you want to delete this task?')) {
			taskService.deleteTask(nodeId, taskId, projectSlug);
			onTasksUpdated?.();
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
		{@const person = peopleService.getPerson(task.assignee)}
		{@const isResolved = !!task.resolvedAt}
		{@const overdue = task.dueDate && !isResolved && isOverdue(task.dueDate)}
		
		<div class="group flex items-start gap-2 rounded-lg bg-zinc-800/50 p-3 {isResolved ? 'opacity-60' : ''}">
			<button
				onclick={() => isResolved ? handleUnresolveTask(task.id) : handleResolveTask(task.id)}
				class="mt-0.5 rounded-full border-2 {isResolved 
					? 'border-green-500 bg-green-500 hover:border-zinc-600 hover:bg-transparent' 
					: 'border-zinc-600 hover:border-green-500'} p-1 transition-colors"
			>
				{#if isResolved}
					<Check class="h-3 w-3 text-white group-hover:text-zinc-400" />
				{:else}
					<div class="h-3 w-3"></div>
				{/if}
			</button>

			<div class="flex-1 min-w-0">
				<div class="flex items-start justify-between gap-2">
					<p class="text-sm text-zinc-100 {isResolved ? 'line-through' : ''}">{task.title}</p>
					<div class="flex items-center gap-1">
						<span class="text-xs text-zinc-400 whitespace-nowrap">
							{person?.name || 'Unknown'}
						</span>
						<div class="opacity-0 group-hover:opacity-100 flex items-center gap-1 ml-2 transition-opacity">
							<button
								onclick={() => handleEditTask(task)}
								class="rounded p-1 text-zinc-500 hover:text-blue-400 hover:bg-zinc-700"
								title="Edit task"
							>
								<Edit class="h-3 w-3" />
							</button>
							{#if isResolved}
								<button
									onclick={() => handleUnresolveTask(task.id)}
									class="rounded p-1 text-zinc-500 hover:text-yellow-400 hover:bg-zinc-700"
									title="Unresolve task"
								>
									<RotateCcw class="h-3 w-3" />
								</button>
							{/if}
							<button
								onclick={() => handleDeleteTask(task.id)}
								class="rounded p-1 text-zinc-500 hover:text-rose-400 hover:bg-zinc-700"
								title="Delete task"
							>
								<Trash2 class="h-3 w-3" />
							</button>
						</div>
					</div>
				</div>

				{#if task.dueDate}
					<div class="mt-1 flex items-center gap-1 text-xs {overdue ? 'text-rose-400' : 'text-zinc-500'}">
						<Calendar class="h-3 w-3" />
						<span>Due {formatDate(task.dueDate)}</span>
						{#if overdue}
							<span class="text-rose-400">(Overdue)</span>
						{/if}
					</div>
				{/if}

				{#if task.notes}
					<div class="mt-1 flex items-start gap-1 text-xs text-zinc-500">
						<StickyNote class="h-3 w-3 mt-0.5 flex-shrink-0" />
						<span class="break-words">{task.notes}</span>
					</div>
				{/if}

				{#if isResolved && task.resolvedAt}
					<div class="mt-1 text-xs text-green-500">
						Resolved {formatDate(task.resolvedAt)}
					</div>
				{/if}
			</div>
		</div>
	{/each}
</div>

<!-- Edit Task Modal -->
{#if editingTask}
	<EditTaskModal
		task={editingTask}
		{nodeId}
		{projectSlug}
		onClose={() => editingTask = null}
		onTaskUpdated={() => {
			editingTask = null;
			onTasksUpdated?.();
		}}
	/>
{/if}