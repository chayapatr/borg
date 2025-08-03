<script lang="ts">
	import { X } from '@lucide/svelte';
	import { ServiceFactory } from '../../services/ServiceFactory';
	import type { IPeopleService, ITaskService } from '../../services/interfaces';
	import type { Task } from '../../types/task';

	interface Props {
		nodeId: string;
		projectSlug?: string;
		task?: Task | undefined; // If provided, this is edit mode; if not, this is add mode
		onClose: () => void;
		onTaskUpdated?: () => void;
		onTaskAdded?: () => void;
	}

	let { nodeId, projectSlug, task, onClose, onTaskUpdated, onTaskAdded }: Props = $props();

	const peopleService: IPeopleService = ServiceFactory.createPeopleService();
	const taskService: ITaskService = ServiceFactory.createTaskService();
	let people = $state<any[]>([]);

	// Determine if this is edit mode
	const isEditMode = $derived(!!task);
	const modalTitle = $derived(isEditMode ? 'Edit Task' : 'Add Task');
	const submitButtonText = $derived(isEditMode ? 'Save Changes' : 'Add Task');

	// Load people on mount
	$effect(() => {
		(async () => {
			const result = peopleService.getAllPeople();
			people = result instanceof Promise ? await result : result;
		})();
	});

	// Initialize form values
	let title = $state(task?.title || '');
	let assignee = $state(task?.assignee || '');
	let dueDate = $state(task?.dueDate || '');
	let notes = $state(task?.notes || '');

	async function handleSubmit(e: Event) {
		e.preventDefault();
		
		if (!title.trim()) return;

		if (isEditMode && task) {
			// Edit mode - update existing task
			const updates: Partial<Task> = {
				title: title.trim(),
				assignee: assignee || '',
				dueDate: dueDate && dueDate.trim() ? dueDate.trim() : '',
				notes: notes && notes.trim() ? notes.trim() : ''
			};

			const result = taskService.updateTask(nodeId, task.id, updates, projectSlug);
			if (result instanceof Promise) await result;
			onTaskUpdated?.();
		} else {
			// Add mode - create new task
			const taskData: Omit<Task, 'id' | 'createdAt'> = {
				title: title.trim(),
				assignee: assignee || '',
				dueDate: dueDate && dueDate.trim() ? dueDate.trim() : '',
				notes: notes && notes.trim() ? notes.trim() : ''
			};

			const result = taskService.addTask(nodeId, taskData, projectSlug);
			if (result instanceof Promise) await result;
			onTaskAdded?.();
		}
		
		onClose();
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
	<div class="w-full max-w-md rounded-lg bg-zinc-900 p-6 shadow-xl">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-semibold text-zinc-100">{modalTitle}</h2>
			<button
				onclick={onClose}
				class="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
			>
				<X class="h-5 w-5" />
			</button>
		</div>

		<form onsubmit={handleSubmit} class="space-y-4">
			<div>
				<label for="title" class="block text-sm font-medium text-zinc-300 mb-1">
					Task Description *
				</label>
				<input
					id="title"
					type="text"
					bind:value={title}
					placeholder="Enter task description..."
					class="w-full rounded-lg bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
					required
				/>
			</div>

			<div>
				<label for="assignee" class="block text-sm font-medium text-zinc-300 mb-1">
					Assign to
				</label>
				<select
					id="assignee"
					bind:value={assignee}
					class="w-full rounded-lg bg-zinc-800 px-3 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					<option value="">Unassigned</option>
					{#each people as person}
						<option value={person.id}>{person.name}</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="dueDate" class="block text-sm font-medium text-zinc-300 mb-1">
					Due Date
				</label>
				<input
					id="dueDate"
					type="date"
					bind:value={dueDate}
					class="w-full rounded-lg bg-zinc-800 px-3 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>

			<div>
				<label for="notes" class="block text-sm font-medium text-zinc-300 mb-1">
					Notes
				</label>
				<textarea
					id="notes"
					bind:value={notes}
					rows="3"
					placeholder="Additional notes..."
					class="w-full rounded-lg bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
				></textarea>
			</div>

			<div class="flex gap-3 pt-4">
				<button
					type="button"
					onclick={onClose}
					class="flex-1 rounded-lg bg-zinc-800 px-4 py-2 text-zinc-300 hover:bg-zinc-700"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={!title.trim()}
					class="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{submitButtonText}
				</button>
			</div>
		</form>
	</div>
</div>