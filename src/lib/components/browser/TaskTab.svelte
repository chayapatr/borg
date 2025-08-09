<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Calendar,
		StickyNote,
		ExternalLink,
		CheckCircle,
		Trash2,
		RotateCcw,
		ChevronDown,
		ChevronRight,
		Folder,
		FolderOpen
	} from '@lucide/svelte';
	import type { ITaskService } from '../../services/interfaces/ITaskService';
	import type { IPeopleService } from '../../services/interfaces/IPeopleService';
	import type { Task, TaskWithContext } from '../../types/task';
	import { goto } from '$app/navigation';

	let { taskService, peopleService, activeTab: currentTab } = $props<{
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

	// Tree expansion state
	let expandedProjects = $state<Set<string>>(new Set());
	let expandedNodes = $state<Set<string>>(new Set());

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

	// Tree expansion functions
	function toggleProject(projectSlug: string) {
		if (expandedProjects.has(projectSlug)) {
			expandedProjects.delete(projectSlug);
		} else {
			expandedProjects.add(projectSlug);
		}
		expandedProjects = new Set(expandedProjects);
	}

	function toggleNode(nodeId: string) {
		if (expandedNodes.has(nodeId)) {
			expandedNodes.delete(nodeId);
		} else {
			expandedNodes.add(nodeId);
		}
		expandedNodes = new Set(expandedNodes);
	}

	// Group tasks hierarchically: Project -> Node -> Task
	function groupTasksHierarchically(tasks: TaskWithContext[]) {
		const hierarchy: Record<
			string,
			{
				project: { slug: string; title: string };
				nodes: Record<
					string,
					{
						node: { id: string; title: string; type: string };
						tasks: TaskWithContext[];
					}
				>;
			}
		> = {};

		for (const task of tasks) {
			const projectSlug = task.projectSlug || 'unknown';
			const projectTitle = task.projectTitle || 'Unknown Project';
			const nodeId = task.nodeId;
			const nodeTitle = task.nodeTitle;
			const nodeType = task.nodeType;

			// Initialize project if not exists
			if (!hierarchy[projectSlug]) {
				hierarchy[projectSlug] = {
					project: { slug: projectSlug, title: projectTitle },
					nodes: {}
				};
			}

			// Initialize node if not exists
			if (!hierarchy[projectSlug].nodes[nodeId]) {
				hierarchy[projectSlug].nodes[nodeId] = {
					node: { id: nodeId, title: nodeTitle, type: nodeType },
					tasks: []
				};
			}

			// Add task to node
			hierarchy[projectSlug].nodes[nodeId].tasks.push(task);
		}

		return hierarchy;
	}

	// Get task stats
	let taskStats = $derived({
		active: activeTasks.length,
		resolved: resolvedTasks.length,
		overdue: activeTasks.filter((t) => t.dueDate && isOverdue(t.dueDate)).length
	});

	// Get hierarchical task structures
	let activeTasksHierarchy = $derived(groupTasksHierarchically(filteredActiveTasks));
	let resolvedTasksHierarchy = $derived(groupTasksHierarchically(filteredResolvedTasks));
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

	<div class=" w-full border-b bg-white px-6 py-4">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="rounded-md text-4xl font-semibold">🦖 Tasks</h2>
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
		{#if viewTab === 'active'}
			{#if filteredActiveTasks.length === 0}
				<div class="mt-12 flex h-full items-center justify-center">
					<div class="text-center">
						<CheckCircle class="mx-auto h-12 w-12 text-zinc-600" />
						<h3 class="mt-4 text-lg font-medium text-black">No active tasks found</h3>
						<p class="mt-2 text-sm text-zinc-500">
							Tasks will appear here when you add them to nodes
						</p>
					</div>
				</div>
			{:else}
				<div class="p-6">
					<!-- Hierarchical Tree View -->
					{#each Object.entries(activeTasksHierarchy) as [projectSlug, projectData]}
						{@const isProjectExpanded = expandedProjects.has(projectSlug)}
						{@const projectTaskCount = Object.values(projectData.nodes).reduce(
							(sum, nodeData) => sum + nodeData.tasks.length,
							0
						)}

						<!-- Project Level -->
						<div class="mb-4">
							<button
								onclick={() => toggleProject(projectSlug)}
								class="flex w-full items-center gap-2 rounded-md border border-black bg-white p-3 text-left transition-colors hover:bg-borg-beige"
							>
								{#if isProjectExpanded}
									<ChevronDown class="h-4 w-4 text-black" />
									<FolderOpen class="h-4 w-4 text-black" />
								{:else}
									<ChevronRight class="h-4 w-4 text-black" />
									<Folder class="h-4 w-4 text-black" />
								{/if}
								<span class="font-semibold text-black">{projectData.project.title}</span>
								<span
									class="ml-auto rounded-full border border-black bg-borg-orange px-2 py-1 text-xs font-bold text-white"
									>{projectTaskCount}</span
								>
							</button>

							{#if isProjectExpanded}
								<div class="mt-2 ml-6 space-y-2">
									<!-- Node Level -->
									{#each Object.entries(projectData.nodes) as [nodeId, nodeData]}
										{@const isNodeExpanded = expandedNodes.has(nodeId)}
										{@const nodeTaskCount = nodeData.tasks.length}

										<div class="mb-2">
											<button
												onclick={() => toggleNode(nodeId)}
												class="flex w-full items-center gap-2 rounded-md border border-black bg-white p-2 text-left transition-colors hover:bg-borg-beige"
											>
												{#if isNodeExpanded}
													<ChevronDown class="h-3 w-3 text-black" />
												{:else}
													<ChevronRight class="h-3 w-3 text-black" />
												{/if}
												<span class="font-medium text-black">{nodeData.node.title}</span>
												<span
													class="rounded-md border border-black bg-white px-1.5 py-0.5 text-xs font-medium text-black"
												>
													{nodeData.node.type}
												</span>
												<span
													class="ml-auto rounded-full border border-black bg-white px-2 py-1 text-xs font-medium text-black"
													>{nodeTaskCount}</span
												>
											</button>

											{#if isNodeExpanded}
												<div class="mt-2 ml-6 space-y-2">
													<!-- Task Level -->
													{#each nodeData.tasks as task}
														{@const personResult = peopleService.getPerson(task.assignee)}
														{#await personResult instanceof Promise ? personResult : Promise.resolve(personResult) then person}
															{@const overdue = task.dueDate && isOverdue(task.dueDate)}

															<div
																class="group rounded-md border border-black bg-white p-3 transition-colors"
															>
																<div class="flex items-start justify-between gap-3">
																	<div class="min-w-0 flex-1">
																		<!-- Task info -->
																		<div class="mb-2 flex items-start justify-between gap-2">
																			<h4 class="font-medium text-black">{task.title}</h4>
																			<div class="flex items-center gap-1">
																				<button
																					onclick={() => handleResolveTask(task)}
																					class="rounded-full p-1 opacity-0 transition-all group-hover:opacity-100"
																					title="Mark as resolved"
																				>
																					<CheckCircle
																						class="h-3.5 w-3.5 text-zinc-500 hover:text-green-500"
																					/>
																				</button>
																				<button
																					onclick={() => handleDeleteTask(task)}
																					class="rounded-full p-1 opacity-0 transition-all group-hover:opacity-100"
																					title="Delete task permanently"
																				>
																					<Trash2
																						class="h-3.5 w-3.5 text-zinc-500 hover:text-rose-500"
																					/>
																				</button>
																				<!-- <button
																					onclick={() => handleTaskClick(task)}
																					class="rounded-full p-1 opacity-0 transition-all group-hover:opacity-100"
																					title="Go to project"
																				>
																					<ExternalLink
																						class="h-3.5 w-3.5 text-zinc-500 hover:text-borg-purple"
																					/>
																				</button> -->
																			</div>
																		</div>

																		<!-- Assignee and meta info -->
																		<div class="flex items-center gap-4 text-xs text-zinc-500">
																			<span
																				class=" rounded-full bg-borg-orange px-2 py-[0.15rem] text-white"
																				>{person?.name || 'Unassigned'}</span
																			>

																			{#if task.dueDate}
																				<div
																					class="flex items-center gap-1 {overdue
																						? 'text-rose-400'
																						: ''}"
																				>
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
																		</div>
																	</div>
																</div>
															</div>
														{/await}
													{/each}
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{:else if filteredResolvedTasks.length === 0}
			<div class="mt-12 flex h-full items-center justify-center">
				<div class="text-center">
					<CheckCircle class="mx-auto h-12 w-12 text-zinc-600" />
					<h3 class="mt-4 text-lg font-medium text-black">No resolved tasks found</h3>
					<p class="mt-2 text-sm text-zinc-500">
						Resolved tasks will appear here when you mark tasks as complete
					</p>
				</div>
			</div>
		{:else}
			<div class="p-6">
				<!-- Hierarchical Tree View for Resolved Tasks -->
				{#each Object.entries(resolvedTasksHierarchy) as [projectSlug, projectData]}
					{@const isProjectExpanded = expandedProjects.has(projectSlug)}
					{@const projectTaskCount = Object.values(projectData.nodes).reduce(
						(sum, nodeData) => sum + nodeData.tasks.length,
						0
					)}

					<!-- Project Level -->
					<div class="mb-4 opacity-75">
						<button
							onclick={() => toggleProject(projectSlug)}
							class="flex w-full items-center gap-2 rounded-md border border-black bg-white p-3 text-left transition-colors hover:bg-borg-beige"
						>
							{#if isProjectExpanded}
								<ChevronDown class="h-4 w-4 text-black" />
								<FolderOpen class="h-4 w-4 text-black" />
							{:else}
								<ChevronRight class="h-4 w-4 text-black" />
								<Folder class="h-4 w-4 text-black" />
							{/if}
							<span class="font-semibold text-black">{projectData.project.title}</span>
							<span
								class="ml-auto rounded-full border border-black bg-borg-green px-2 py-1 text-xs font-bold text-white"
								>{projectTaskCount}</span
							>
						</button>

						{#if isProjectExpanded}
							<div class="mt-2 ml-6 space-y-2">
								<!-- Node Level -->
								{#each Object.entries(projectData.nodes) as [nodeId, nodeData]}
									{@const isNodeExpanded = expandedNodes.has(nodeId)}
									{@const nodeTaskCount = nodeData.tasks.length}

									<div class="mb-2">
										<button
											onclick={() => toggleNode(nodeId)}
											class="flex w-full items-center gap-2 rounded-md border border-black bg-white p-2 text-left transition-colors hover:bg-borg-beige"
										>
											{#if isNodeExpanded}
												<ChevronDown class="h-3 w-3 text-black" />
											{:else}
												<ChevronRight class="h-3 w-3 text-black" />
											{/if}
											<span class="font-medium text-black line-through">{nodeData.node.title}</span>
											<span
												class="rounded-md border border-black bg-white px-1.5 py-0.5 text-xs font-medium text-black opacity-75"
											>
												{nodeData.node.type}
											</span>
											<span
												class="ml-auto rounded-full border border-black bg-white px-2 py-1 text-xs font-medium text-black"
												>{nodeTaskCount}</span
											>
										</button>

										{#if isNodeExpanded}
											<div class="mt-2 ml-6 space-y-2">
												<!-- Task Level -->
												{#each nodeData.tasks as task}
													{@const personResult = peopleService.getPerson(task.assignee)}
													{#await personResult instanceof Promise ? personResult : Promise.resolve(personResult) then person}
														<div
															class="group rounded-md border border-black bg-white p-3 opacity-75 transition-colors"
														>
															<div class="flex items-start justify-between gap-3">
																<div class="min-w-0 flex-1">
																	<!-- Task info -->
																	<div class="mb-2 flex items-start justify-between gap-2">
																		<h4 class="font-medium text-black line-through">
																			{task.title}
																		</h4>
																		<div class="flex items-center gap-1">
																			<button
																				onclick={() => handleReactivateTask(task)}
																				class="rounded-full p-1 opacity-0 transition-all group-hover:opacity-100"
																				title="Reactivate task"
																			>
																				<RotateCcw
																					class="h-3.5 w-3.5 text-zinc-500 hover:text-borg-orange"
																				/>
																			</button>
																			<button
																				onclick={() => handleDeleteTask(task)}
																				class="rounded-full p-1 opacity-0 transition-all group-hover:opacity-100"
																				title="Delete task permanently"
																			>
																				<Trash2
																					class="h-3.5 w-3.5 text-zinc-500 hover:text-rose-500"
																				/>
																			</button>
																			<!-- <button
																				onclick={() => handleTaskClick(task)}
																				class="rounded-full p-1 opacity-0 transition-all group-hover:opacity-100"
																				title="Go to project"
																			>
																				<ExternalLink
																					class="h-3.5 w-3.5 text-zinc-500 hover:text-borg-purple"
																				/>
																			</button> -->
																		</div>
																	</div>

																	<!-- Assignee and meta info -->
																	<div class="flex items-center gap-4 text-xs text-zinc-500">
																		<span>👤 {person?.name || 'Unassigned'}</span>

																		{#if task.dueDate}
																			<div class="flex items-center gap-1">
																				<Calendar class="h-3 w-3" />
																				<span>Due {formatDate(task.dueDate)}</span>
																			</div>
																		{/if}

																		{#if task.notes}
																			<div class="flex items-center gap-1">
																				<StickyNote class="h-3 w-3" />
																				<span>Has notes</span>
																			</div>
																		{/if}

																		<div class="flex items-center gap-1 text-green-600">
																			<CheckCircle class="h-3 w-3" />
																			<span>Resolved</span>
																		</div>
																	</div>
																</div>
															</div>
														</div>
													{/await}
												{/each}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
