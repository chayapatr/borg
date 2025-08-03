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
		{@const person = allPeople.find(p => p.id === task.assignee)}
		{@const overdue = task.dueDate && isOverdue(task.dueDate)}
		
		<div class="group flex items-start gap-2 rounded-lg bg-zinc-800/50 p-3">
			<button
				onclick={() => handleResolveTask(task.id)}
				class="mt-0.5 rounded-full border-2 border-zinc-600 hover:border-green-500 hover:bg-green-500 p-1 transition-all duration-200"
				title="Resolve task (delete)"
			>
				<Check class="h-3 w-3" />
			</button>

			<div class="flex-1 min-w-0">
				<div class="flex items-start justify-between gap-2">
					<p class="text-sm text-zinc-100">{task.title}</p>
					<div class="flex items-center gap-1">
						<span class="text-xs text-zinc-400 whitespace-nowrap">
							{person?.name || (task.assignee ? `User ${task.assignee.slice(0, 8)}` : 'Unassigned')}
						</span>
						<div class="opacity-0 group-hover:opacity-100 flex items-center gap-1 ml-2 transition-opacity">
							<button
								onclick={() => handleEditTask(task)}
								class="rounded p-1 text-zinc-500 hover:text-blue-400 hover:bg-zinc-700"
								title="Edit task"
							>
								<Edit class="h-3 w-3" />
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
		onClose={() => editingTask = null}
		onTaskUpdated={() => {
			editingTask = null;
			onTasksUpdated?.();
		}}
	/>
{/if}