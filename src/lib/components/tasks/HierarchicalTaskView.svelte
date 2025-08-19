<script lang="ts">
	import {
		Calendar,
		StickyNote,
		CheckCircle,
		Trash2,
		RotateCcw,
		ChevronDown,
		ChevronRight,
		Loader2
	} from '@lucide/svelte';
	import type { TaskWithContext } from '../../types/task';
	import type { IPeopleService } from '../../services/interfaces/IPeopleService';

	let {
		tasks,
		peopleService,
		showActions = false,
		isResolved = false,
		onResolveTask,
		onDeleteTask,
		onReactivateTask
	} = $props<{
		tasks: TaskWithContext[];
		peopleService?: IPeopleService;
		showActions?: boolean;
		isResolved?: boolean;
		onResolveTask?: (task: TaskWithContext) => void;
		onDeleteTask?: (task: TaskWithContext) => void;
		onReactivateTask?: (task: TaskWithContext) => void;
	}>();

	// Project expansion state
	let expandedProjects = $state<Set<string>>(new Set());
	// Loading states for task actions
	let loadingTasks = $state<Set<string>>(new Set());

	// Project expansion functions
	function toggleProject(projectSlug: string) {
		if (expandedProjects.has(projectSlug)) {
			expandedProjects.delete(projectSlug);
		} else {
			expandedProjects.add(projectSlug);
		}
		expandedProjects = new Set(expandedProjects);
	}

	// Task action handlers with loading states
	async function handleResolveTask(task: TaskWithContext) {
		loadingTasks.add(task.id);
		loadingTasks = new Set(loadingTasks);

		try {
			await onResolveTask?.(task);
		} finally {
			loadingTasks.delete(task.id);
			loadingTasks = new Set(loadingTasks);
		}
	}

	async function handleReactivateTask(task: TaskWithContext) {
		loadingTasks.add(task.id);
		loadingTasks = new Set(loadingTasks);

		try {
			await onReactivateTask?.(task);
		} finally {
			loadingTasks.delete(task.id);
			loadingTasks = new Set(loadingTasks);
		}
	}

	// Group tasks by project and node
	function groupTasksByProjectAndNode(tasks: TaskWithContext[]) {
		const projects: Record<
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

			if (!projects[projectSlug]) {
				projects[projectSlug] = {
					project: { slug: projectSlug, title: projectTitle },
					nodes: {}
				};
			}

			if (!projects[projectSlug].nodes[nodeId]) {
				projects[projectSlug].nodes[nodeId] = {
					node: { id: nodeId, title: nodeTitle, type: nodeType },
					tasks: []
				};
			}

			projects[projectSlug].nodes[nodeId].tasks.push(task);
		}

		return projects;
	}

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString();
	}

	function isOverdue(dueDate: string) {
		return new Date(dueDate) < new Date();
	}

	// Get project and node grouped tasks
	let tasksByProject = $derived(groupTasksByProjectAndNode(tasks));
</script>

{#if tasks.length === 0}
	<div class="mt-12 flex h-full items-center justify-center">
		<div class="text-center">
			<CheckCircle class="mx-auto h-12 w-12 text-zinc-600" />
			<h3 class="mt-4 text-lg font-medium text-black">
				No {isResolved ? 'resolved' : 'active'} tasks found
			</h3>
			<p class="mt-2 text-sm text-zinc-500">
				{isResolved
					? 'Resolved tasks will appear here when you mark tasks as complete'
					: 'Tasks will appear here when you add them to nodes'}
			</p>
		</div>
	</div>
{:else}
	<div class="space-y-4">
		{#each Object.entries(tasksByProject) as [projectSlug, projectData]}
			{@const isProjectExpanded = expandedProjects.has(projectSlug)}
			{@const projectTaskCount = Object.values(projectData.nodes).reduce(
				(sum, nodeData) => sum + nodeData.tasks.length,
				0
			)}

			<!-- Project Header -->
			<div class="space-y-2">
				<button
					onclick={() => toggleProject(projectSlug)}
					class="box-shadow-black flex w-full items-center gap-2 rounded-md border border-black bg-white p-3 text-left font-semibold text-black transition-colors hover:bg-borg-beige"
				>
					{#if isProjectExpanded}
						<ChevronDown class="h-4 w-4" />
					{:else}
						<ChevronRight class="h-4 w-4" />
					{/if}
					{projectData.project.title} ({projectTaskCount})
				</button>

				{#if isProjectExpanded}
					<div class="space-y-4 pl-6">
						{#each Object.entries(projectData.nodes) as [nodeId, nodeData]}
							{@const nodeTaskCount = nodeData.tasks.length}

							<!-- Node Header -->
							<div class="space-y-3">
								<div class="flex items-center gap-3 pt-2">
									<h4 class="text-base font-semibold text-black">
										{nodeData.node.title}
									</h4>
									<span
										class="rounded-md border border-black bg-white px-2 py-1 text-xs font-medium text-black"
									>
										{nodeData.node.type}
									</span>
									<span class="text-sm font-medium text-zinc-600">
										{nodeTaskCount} tasks
									</span>
								</div>

								<!-- Tasks under this node -->
								<div class="space-y-1">
									{#each nodeData.tasks as task}
										{@const personResult = peopleService?.getPerson(task.assignee)}
										{@const isLoading = loadingTasks.has(task.id)}
										{#await personResult instanceof Promise ? personResult : Promise.resolve(personResult)}
											<!-- Loading state for person data -->
											<div class="group flex items-start gap-3 rounded-md px-3 py-2 opacity-60">
												<div class="flex items-center pt-0.5">
													<div class="h-4 w-4 rounded border border-zinc-300"></div>
												</div>
												<div class="min-w-0 flex-1">
													<div class="mb-1 flex items-center gap-2">
														<span class="text-sm text-zinc-900">
															{task.title}
														</span>
														<div class="h-5 w-5 animate-pulse rounded-full bg-zinc-200"></div>
													</div>
													<div class="flex items-center gap-3 text-xs text-zinc-500">
														<div class="h-3 w-12 animate-pulse rounded bg-zinc-200"></div>
													</div>
												</div>
											</div>
										{:then person}
											{@const overdue = task.dueDate && isOverdue(task.dueDate)}

											<div
												class="group flex items-start gap-3 rounded-md px-3 py-2 transition-colors hover:bg-zinc-50"
											>
												<!-- Checkbox -->
												<div class="flex items-center pt-0.5">
													{#if showActions && !isResolved}
														<button
															onclick={(e) => {
																e.stopPropagation();
																handleResolveTask(task);
															}}
															class="rounded border border-zinc-500 p-0.5 hover:border-green-500 hover:bg-green-50 {isLoading
																? 'opacity-50'
																: ''}"
															title="Mark as resolved"
															disabled={isLoading}
														>
															{#if isLoading}
																<Loader2 class="h-3 w-3 animate-spin text-zinc-500" />
															{:else}
																<CheckCircle class="h-3 w-3 text-transparent" />
															{/if}
														</button>
													{:else if showActions && isResolved}
														<button
															onclick={(e) => {
																e.stopPropagation();
																handleReactivateTask(task);
															}}
															class="rounded border border-green-500 bg-green-500 p-0.5 hover:bg-green-600 {isLoading
																? 'opacity-50'
																: ''}"
															title="Reactivate task"
															disabled={isLoading}
														>
															{#if isLoading}
																<Loader2 class="h-3 w-3 animate-spin text-white" />
															{:else}
																<CheckCircle class="h-3 w-3 text-white" />
															{/if}
														</button>
													{:else}
														<div class="h-4 w-4 rounded border border-zinc-300"></div>
													{/if}
												</div>

												<!-- Task content -->
												<div class="min-w-0 flex-1">
													<div class="mb-1 flex items-center gap-2">
														<span
															class="text-sm text-zinc-900 {isResolved
																? 'line-through opacity-60'
																: ''}"
														>
															{task.title}
														</span>
														{#if peopleService && person?.photoUrl}
															<img
																src={person.photoUrl}
																alt={person.name || 'Assignee'}
																class="h-5 w-5 rounded-full"
																title={person.name || 'Unassigned'}
															/>
														{/if}
													</div>

													<!-- Task meta info -->
													<div class="flex items-center gap-3 text-xs text-zinc-500">
														{#if task.dueDate}
															<div class="flex items-center gap-1 {overdue ? 'text-rose-500' : ''}">
																<Calendar class="h-3 w-3" />
																<span>Due {formatDate(task.dueDate)}</span>
																{#if overdue && !isResolved}
																	<span class="text-rose-500">(Overdue)</span>
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

												<!-- Delete button -->
												{#if showActions}
													<div
														class="flex items-center opacity-0 transition-opacity group-hover:opacity-100"
													>
														<button
															onclick={() => onDeleteTask?.(task)}
															class="rounded p-1 hover:bg-rose-100"
															title="Delete task"
														>
															<Trash2 class="h-4 w-4 text-zinc-400 hover:text-rose-600" />
														</button>
													</div>
												{/if}
											</div>
										{/await}
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}
