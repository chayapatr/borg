<script lang="ts">
	import { X, Trash2 } from '@lucide/svelte';
	import { ServiceFactory } from '$lib/services/ServiceFactory';
	import type { IPeopleService, ITaskService } from '$lib/services/interfaces';
	import type { Task } from '$lib/types/task';
	import { authStore } from '$lib/stores/authStore';

	interface Props {
		wikiId: string;
		wikiTitle: string;
		task?: Task | null;
		onClose: () => void;
		onSave: (task: Task) => void;
		onDelete: () => void;
	}

	let { wikiId, wikiTitle, task, onClose, onSave, onDelete }: Props = $props();

	const peopleService: IPeopleService = ServiceFactory.createPeopleService();
	const taskService: ITaskService = ServiceFactory.createTaskService();
	let people = $state<any[]>([]);

	const isEditMode = $derived(!!task?.id);

	// Load people on mount
	$effect(() => {
		(async () => {
			const result = peopleService.getAllPeople();
			people = result instanceof Promise ? await result : result;
		})();
	});

	// Form values
	let title = $state(task?.title || '');
	let assignee = $state(task?.assignee || $authStore.user?.uid || '');
	let dueDate = $state(task?.dueDate || '');
	let notes = $state(task?.notes || '');
	let isLoading = $state(false);

	// Update form when task changes
	$effect(() => {
		if (task) {
			title = task.title || '';
			assignee = task.assignee || $authStore.user?.uid || '';
			dueDate = task.dueDate || '';
			notes = task.notes || '';
		}
	});

	async function handleSave() {
		if (!title.trim()) return;

		isLoading = true;

		try {
			if (isEditMode && task) {
				// Update existing task
				const updates: Partial<Task> = {
					title: title.trim(),
					assignee: assignee || '',
					dueDate: dueDate?.trim() || '',
					notes: notes?.trim() || ''
				};

				const result = taskService.updateTask(wikiId, task.id, updates);
				if (result instanceof Promise) await result;

				onSave({ ...task, ...updates });
			} else {
				// Create new task
				const taskData: Omit<Task, 'id' | 'createdAt'> = {
					title: title.trim(),
					assignee: assignee || '',
					dueDate: dueDate?.trim() || '',
					notes: notes?.trim() || ''
				};

				// Pass wiki options for task creation
				const result = taskService.addTask(wikiId, taskData, {
					wikiId: wikiId,
					wikiTitle: wikiTitle
				});
				if (result instanceof Promise) await result;

				// Fetch the newly created task to get its ID
				const tasksResult = taskService.getNodeTasks(wikiId);
				const tasks = tasksResult instanceof Promise ? await tasksResult : tasksResult;
				const newTask = tasks.find((t) => t.title === taskData.title);

				if (newTask) {
					onSave(newTask);
				}
			}
		} catch (error) {
			console.error('Error saving task:', error);
		} finally {
			isLoading = false;
		}
	}

	async function handleDelete() {
		if (!task?.id) return;

		isLoading = true;
		try {
			const result = taskService.deleteTask(wikiId, task.id);
			if (result instanceof Promise) await result;
			onDelete();
		} catch (error) {
			console.error('Error deleting task:', error);
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="flex h-full w-80 flex-col border-l border-black bg-borg-white shadow-lg">
	<!-- Header -->
	<div class="flex h-14 shrink-0 items-center justify-between border-b border-black px-4">
		<h3 class="font-semibold">{isEditMode ? 'Edit Task' : 'New Task'}</h3>
		<button onclick={onClose} class="rounded p-1 hover:bg-borg-beige">
			<X class="h-5 w-5" />
		</button>
	</div>

	<!-- Form -->
	<div class="flex-1 overflow-y-auto p-4">
		<div class="space-y-4">
			<!-- Wiki link info -->
			<div class="rounded-lg bg-borg-beige/50 p-3 text-sm">
				<span class="text-zinc-500">Linked to:</span>
				<span class="ml-1 font-medium">{wikiTitle || 'Untitled Wiki'}</span>
			</div>

			<!-- Title -->
			<div>
				<label for="task-title" class="mb-1 block text-sm font-medium text-zinc-600">
					Task Description *
				</label>
				<input
					id="task-title"
					type="text"
					bind:value={title}
					placeholder="What needs to be done?"
					class="w-full rounded-lg border border-black bg-white px-3 py-2 text-black placeholder-zinc-400 outline-none focus:ring-2 focus:ring-black/20"
					disabled={isLoading}
				/>
			</div>

			<!-- Assignee -->
			<div>
				<label for="task-assignee" class="mb-1 block text-sm font-medium text-zinc-600">
					Assign to
				</label>
				<select
					id="task-assignee"
					bind:value={assignee}
					class="w-full rounded-lg border border-black bg-white px-3 py-2 text-black outline-none focus:ring-2 focus:ring-black/20"
					disabled={isLoading}
				>
					<option value="">Unassigned</option>
					{#each people as person}
						<option value={person.id}>{person.name}</option>
					{/each}
				</select>
			</div>

			<!-- Due Date -->
			<div>
				<label for="task-due" class="mb-1 block text-sm font-medium text-zinc-600">Due Date</label>
				<input
					id="task-due"
					type="date"
					bind:value={dueDate}
					class="w-full rounded-lg border border-black bg-white px-3 py-2 text-black outline-none focus:ring-2 focus:ring-black/20"
					disabled={isLoading}
				/>
			</div>

			<!-- Notes -->
			<div>
				<label for="task-notes" class="mb-1 block text-sm font-medium text-zinc-600">Notes</label>
				<textarea
					id="task-notes"
					bind:value={notes}
					rows="4"
					placeholder="Additional details..."
					class="w-full rounded-lg border border-black bg-white px-3 py-2 text-black placeholder-zinc-400 outline-none focus:ring-2 focus:ring-black/20"
					disabled={isLoading}
				></textarea>
			</div>
		</div>
	</div>

	<!-- Actions -->
	<div class="shrink-0 border-t border-black p-4">
		<div class="flex gap-2">
			{#if isEditMode}
				<button
					onclick={handleDelete}
					disabled={isLoading}
					class="flex items-center justify-center rounded-lg border border-red-600 px-3 py-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
				>
					<Trash2 class="h-4 w-4" />
				</button>
			{/if}
			<button
				onclick={onClose}
				disabled={isLoading}
				class="flex-1 rounded-lg border border-black px-4 py-2 hover:bg-borg-beige disabled:opacity-50"
			>
				Cancel
			</button>
			<button
				onclick={handleSave}
				disabled={!title.trim() || isLoading}
				class="flex-1 rounded-lg bg-black px-4 py-2 text-white hover:bg-zinc-800 disabled:opacity-50"
			>
				{#if isLoading}
					Saving...
				{:else}
					{isEditMode ? 'Save' : 'Create'}
				{/if}
			</button>
		</div>
	</div>
</div>
