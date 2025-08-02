<script lang="ts">
	import { onMount } from 'svelte';
	import { Calendar, StickyNote, ExternalLink, CheckCircle } from '@lucide/svelte';
	import { TaskService } from '../../services/TaskService';
	import { PeopleService } from '../../services/PeopleService';
	import type { TaskWithContext } from '../../types/task';
	import { goto } from '$app/navigation';

	const taskService = new TaskService();
	const peopleService = new PeopleService();

	let tasks = $state<TaskWithContext[]>([]);
	let filteredTasks = $state<TaskWithContext[]>([]);
	let filter = $state<'all' | 'active' | 'resolved'>('active');
	let searchQuery = $state('');

	onMount(() => {
		loadTasks();
	});

	function loadTasks() {
		tasks = taskService.getAllTasks();
		applyFilters();
	}

	function applyFilters() {
		let filtered = tasks;

		// Filter by status
		if (filter === 'active') {
			filtered = filtered.filter(task => !task.resolvedAt);
		} else if (filter === 'resolved') {
			filtered = filtered.filter(task => task.resolvedAt);
		}

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(task => 
				task.title.toLowerCase().includes(query) ||
				task.nodeTitle.toLowerCase().includes(query) ||
				task.projectTitle?.toLowerCase().includes(query) ||
				peopleService.getPerson(task.assignee)?.name.toLowerCase().includes(query)
			);
		}

		filteredTasks = filtered;
	}

	$effect(() => {
		applyFilters();
	});

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString();
	}

	function isOverdue(dueDate: string) {
		return new Date(dueDate) < new Date();
	}

	function handleTaskClick(task: TaskWithContext) {
		if (task.projectSlug) {
			goto(`/project/${task.projectSlug}`);
		}
	}

	function handleResolveTask(task: TaskWithContext) {
		taskService.resolveTask(task.nodeId, task.id, task.projectSlug);
		loadTasks();
	}

	// Get task stats
	let taskStats = $derived({
		total: tasks.length,
		active: tasks.filter(t => !t.resolvedAt).length,
		resolved: tasks.filter(t => t.resolvedAt).length,
		overdue: tasks.filter(t => t.dueDate && !t.resolvedAt && isOverdue(t.dueDate)).length
	});
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	<div class="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-xl font-semibold text-zinc-100">Tasks</h1>
				<p class="mt-1 text-sm text-zinc-400">All tasks across projects</p>
			</div>
			
			<!-- Stats -->
			<div class="flex items-center gap-4">
				<div class="flex items-center gap-1">
					<span class="text-xs text-zinc-400">Active</span>
					<span class="rounded-full bg-blue-500/20 px-2 py-1 text-xs text-blue-400">{taskStats.active}</span>
				</div>
				<div class="flex items-center gap-1">
					<span class="text-xs text-zinc-400">Resolved</span>
					<span class="rounded-full bg-green-500/20 px-2 py-1 text-xs text-green-400">{taskStats.resolved}</span>
				</div>
				{#if taskStats.overdue > 0}
					<div class="flex items-center gap-1">
						<span class="text-xs text-zinc-400">Overdue</span>
						<span class="rounded-full bg-rose-500/20 px-2 py-1 text-xs text-rose-400">{taskStats.overdue}</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Filters -->
		<div class="mt-4 flex items-center gap-4">
			<div class="flex rounded-lg bg-zinc-800 p-1">
				<button
					onclick={() => filter = 'active'}
					class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {filter === 'active'
						? 'bg-zinc-700 text-zinc-100'
						: 'text-zinc-400 hover:text-zinc-300'}"
				>
					Active
				</button>
				<button
					onclick={() => filter = 'all'}
					class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {filter === 'all'
						? 'bg-zinc-700 text-zinc-100'
						: 'text-zinc-400 hover:text-zinc-300'}"
				>
					All
				</button>
				<button
					onclick={() => filter = 'resolved'}
					class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {filter === 'resolved'
						? 'bg-zinc-700 text-zinc-100'
						: 'text-zinc-400 hover:text-zinc-300'}"
				>
					Resolved
				</button>
			</div>

			<div class="flex-1">
				<input
					type="text"
					placeholder="Search tasks..."
					bind:value={searchQuery}
					class="w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>
		</div>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-auto">
		{#if filteredTasks.length === 0}
			<div class="flex h-full items-center justify-center">
				<div class="text-center">
					<CheckCircle class="mx-auto h-12 w-12 text-zinc-600" />
					<h3 class="mt-4 text-lg font-medium text-zinc-300">
						{filter === 'resolved' ? 'No resolved tasks' : 'No active tasks'}
					</h3>
					<p class="mt-2 text-sm text-zinc-500">
						{filter === 'resolved' 
							? 'Completed tasks will appear here' 
							: 'Tasks will appear here when you add them to nodes'}
					</p>
				</div>
			</div>
		{:else}
			<div class="space-y-1 p-4">
				{#each filteredTasks as task}
					{@const person = peopleService.getPerson(task.assignee)}
					{@const isResolved = !!task.resolvedAt}
					{@const overdue = task.dueDate && !isResolved && isOverdue(task.dueDate)}
					
					<div class="group rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700 transition-colors">
						<div class="flex items-start justify-between gap-3">
							<div class="flex-1 min-w-0">
								<!-- Task info -->
								<div class="flex items-start justify-between gap-2 mb-2">
									<h3 class="font-medium text-zinc-100 {isResolved ? 'line-through opacity-60' : ''}">{task.title}</h3>
									<div class="flex items-center gap-2">
										{#if !isResolved}
											<button
												onclick={() => handleResolveTask(task)}
												class="opacity-0 group-hover:opacity-100 rounded-full border-2 border-zinc-600 hover:border-green-500 p-1 transition-all"
											>
												<CheckCircle class="h-4 w-4 text-zinc-400 hover:text-green-500" />
											</button>
										{/if}
										<button
											onclick={() => handleTaskClick(task)}
											class="opacity-0 group-hover:opacity-100 rounded-full bg-zinc-800 hover:bg-zinc-700 p-1 transition-all"
										>
											<ExternalLink class="h-4 w-4 text-zinc-400 hover:text-zinc-300" />
										</button>
									</div>
								</div>

								<!-- Context info -->
								<div class="flex items-center gap-2 text-sm text-zinc-500 mb-2">
									<span class="font-medium">{task.projectTitle || 'Unknown Project'}</span>
									<span>→</span>
									<span>{task.nodeTitle}</span>
									<span>•</span>
									<span>{person?.name || 'Unknown'}</span>
								</div>

								<!-- Meta info -->
								<div class="flex items-center gap-4 text-xs text-zinc-500">
									{#if task.dueDate}
										<div class="flex items-center gap-1 {overdue ? 'text-rose-400' : ''}">
											<Calendar class="h-3 w-3" />
											<span>Due {formatDate(task.dueDate)}</span>
											{#if overdue}
												<span class="text-rose-400">(Overdue)</span>
											{/if}
										</div>
									{/if}

									{#if task.notes}
										<div class="flex items-center gap-1">
											<StickyNote class="h-3 w-3" />
											<span>Has notes</span>
										</div>
									{/if}

									{#if isResolved && task.resolvedAt}
										<div class="text-green-500">
											Resolved {formatDate(task.resolvedAt)}
										</div>
									{/if}
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>