<script lang="ts">
	import { onMount } from 'svelte';
	import { CheckSquare } from '@lucide/svelte';
	import type { ITaskService } from '../../services/interfaces/ITaskService';
	import type { IPeopleService } from '../../services/interfaces/IPeopleService';
	import type { Task, TaskWithContext } from '../../types/task';
	import { goto } from '$app/navigation';
	import HierarchicalTaskView from '../tasks/HierarchicalTaskView.svelte';

	let {
		taskService,
		peopleService,
		activeTab: currentTab
	} = $props<{
		taskService: ITaskService;
		peopleService: IPeopleService;
		activeTab: string;
	}>();

	let activeTasks = $state<TaskWithContext[]>([]);
	let resolvedTasks = $state<TaskWithContext[]>([]);
	let filteredActiveTasks = $state<TaskWithContext[]>([]);
	let filteredResolvedTasks = $state<TaskWithContext[]>([]);
	let viewTab = $state<'active' | 'resolved'>('active');
	let searchQuery = $state('');
	let dataLoaded = $state(false);

	// Lazy load data when tab becomes active
	$effect(() => {
		if (currentTab === 'tasks' && !dataLoaded) {
			loadTasks();
		}
	});

	async function loadTasks(force = false) {
		if (dataLoaded && !force) return; // Prevent duplicate loading unless forced

		const activeResult = taskService.getActiveTasks();
		activeTasks = activeResult instanceof Promise ? await activeResult : activeResult;

		const resolvedResult = taskService.getResolvedTasks();
		resolvedTasks = resolvedResult instanceof Promise ? await resolvedResult : resolvedResult;

		applyFilters();
		dataLoaded = true;
	}

	async function applyFilters() {
		await applyFiltersToTasks(activeTasks, 'active');
		await applyFiltersToTasks(resolvedTasks, 'resolved');
	}

	async function applyFiltersToTasks(tasks: TaskWithContext[], type: 'active' | 'resolved') {
		let filtered = tasks;

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			const matchingTasks = [];

			for (const task of filtered) {
				const titleMatch = task.title.toLowerCase().includes(query);
				const nodeMatch = task.nodeTitle.toLowerCase().includes(query);
				const projectMatch = task.projectTitle?.toLowerCase().includes(query);

				let personMatch = false;
				if (task.assignee) {
					const result = peopleService.getPerson(task.assignee);
					const person = result instanceof Promise ? await result : result;
					personMatch = person?.name.toLowerCase().includes(query) || false;
				}

				if (titleMatch || nodeMatch || projectMatch || personMatch) {
					matchingTasks.push(task);
				}
			}

			filtered = matchingTasks;
		}

		if (type === 'active') {
			filteredActiveTasks = filtered;
		} else {
			filteredResolvedTasks = filtered;
		}
	}

	$effect(() => {
		applyFilters();
	});

	async function handleDeleteTask(task: TaskWithContext) {
		if (confirm('Are you sure you want to delete this task permanently?')) {
			const result = taskService.deleteTask(task.nodeId, task.id, task.projectSlug);
			if (result instanceof Promise) await result;
			await loadTasks(true); // Force reload
		}
	}

	async function handleResolveTask(task: TaskWithContext) {
		const result = taskService.resolveTask(task.nodeId, task.id, task.projectSlug);
		if (result instanceof Promise) await result;
		await loadTasks(true); // Force reload
	}

	async function handleReactivateTask(task: TaskWithContext) {
		const result = taskService.updateTask(
			task.nodeId,
			task.id,
			{ status: 'active' } as Partial<Task>,
			task.projectSlug
		);
		if (result instanceof Promise) await result;
		await loadTasks(true); // Force reload
	}

	// Get task stats
	let taskStats = $derived({
		active: activeTasks.length,
		resolved: resolvedTasks.length,
		overdue: activeTasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date()).length
	});
</script>

<div class="flex flex-1 flex-col">
	<!-- Header -->
	<!-- <div class="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-xl font-semibold text-zinc-100">Tasks</h1>
				<p class="mt-1 text-sm text-zinc-400">All tasks across projects</p>
			</div>
			
			Stats
			<div class="flex items-center gap-4">
				<div class="flex items-center gap-1">
					<span class="text-xs text-zinc-400">Total</span>
					<span class="rounded-full bg-blue-500/20 px-2 py-1 text-xs text-blue-400">{taskStats.total}</span>
				</div>
				{#if taskStats.overdue > 0}
					<div class="flex items-center gap-1">
						<span class="text-xs text-zinc-400">Overdue</span>
						<span class="rounded-full bg-rose-500/20 px-2 py-1 text-xs text-rose-400">{taskStats.overdue}</span>
					</div>
				{/if}
			</div>
		</div>

		Search
		<div class="mt-4">
			<input
				type="text"
				placeholder="Search tasks..."
				bind:value={searchQuery}
				class="w-full  bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
			/>
		</div>
	</div> -->

	<div class=" flex h-16 flex-col justify-center border-b bg-white px-6">
		<div class="flex items-center justify-between">
			<div>
				<div class="flex items-center gap-3">
					<CheckSquare class="h-8 w-8" />
					<h2 class="rounded-md text-3xl font-semibold">Tasks</h2>
				</div>
				<!-- <p class="text-zinc-400 mt-1">Manage your research projects</p> -->
			</div>
			<div class="flex items-center gap-4">
				<div class="flex items-center gap-1">
					<span class="text-xs text-black">Active</span>
					<span class="rounded-full bg-borg-orange px-2 py-1 text-xs text-white"
						>{taskStats.active}</span
					>
				</div>
				<div class="flex items-center gap-1">
					<span class="text-xs text-black">Resolved</span>
					<span class="rounded-full bg-green-600 px-2 py-1 text-xs text-white"
						>{taskStats.resolved}</span
					>
				</div>
				{#if taskStats.overdue > 0}
					<div class="flex items-center gap-1">
						<span class="text-xs text-black">Overdue</span>
						<span class="rounded-full bg-zinc-600 px-2 py-1 text-xs text-white"
							>{taskStats.overdue}</span
						>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="mt-4 px-6">
		<input
			type="text"
			placeholder="Search tasks..."
			bind:value={searchQuery}
			class="w-full rounded-md border border-black bg-white px-3 py-2 text-black placeholder-zinc-500 focus:ring-2 focus:ring-borg-blue focus:outline-none"
		/>
	</div>

	<!-- Tab Navigation -->
	<div class="mt-4 px-6">
		<div class="flex border-b border-zinc-200">
			<button
				onclick={() => (viewTab = 'active')}
				class="px-4 py-2 text-sm font-medium transition-colors {viewTab === 'active'
					? 'border-b-2 border-borg-orange text-borg-orange'
					: 'text-zinc-500 hover:text-zinc-700'}"
			>
				Active Tasks ({taskStats.active})
			</button>
			<button
				onclick={() => (viewTab = 'resolved')}
				class="px-4 py-2 text-sm font-medium transition-colors {viewTab === 'resolved'
					? 'border-b-2 border-green-600 text-green-600'
					: 'text-zinc-500 hover:text-zinc-700'}"
			>
				Resolved Tasks ({taskStats.resolved})
			</button>
		</div>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-auto">
		<div class="p-6">
			{#if viewTab === 'active'}
				<HierarchicalTaskView
					tasks={filteredActiveTasks}
					{peopleService}
					showActions={true}
					isResolved={false}
					onResolveTask={handleResolveTask}
					onDeleteTask={handleDeleteTask}
				/>
			{:else}
				<HierarchicalTaskView
					tasks={filteredResolvedTasks}
					{peopleService}
					showActions={true}
					isResolved={true}
					onReactivateTask={handleReactivateTask}
					onDeleteTask={handleDeleteTask}
				/>
			{/if}
		</div>
	</div>
</div>
