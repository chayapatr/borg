<script lang="ts">
	import {
		Calendar,
		StickyNote,
		CheckCircle,
		Trash2,
		RotateCcw,
		ChevronDown,
		ChevronRight,
		Folder,
		FolderOpen
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

	// Tree expansion state
	let expandedProjects = $state<Set<string>>(new Set());
	let expandedNodes = $state<Set<string>>(new Set());

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

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString();
	}

	function isOverdue(dueDate: string) {
		return new Date(dueDate) < new Date();
	}

	// Get hierarchical task structures
	let tasksHierarchy = $derived(groupTasksHierarchically(tasks));
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
	<div class="">
		<!-- Hierarchical Tree View -->
		{#each Object.entries(tasksHierarchy) as [projectSlug, projectData]}
			{@const isProjectExpanded = expandedProjects.has(projectSlug)}
			{@const projectTaskCount = Object.values(projectData.nodes).reduce(
				(sum, nodeData) => sum + nodeData.tasks.length,
				0
			)}

			<!-- Project Level -->
			<div class="mb-4 {isResolved ? 'opacity-75' : ''}">
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
						class="ml-auto rounded-full border border-black bg-{isResolved
							? 'borg-green'
							: 'borg-orange'} px-2 py-1 text-xs font-bold text-white">{projectTaskCount}</span
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
									<span class="font-medium text-black {isResolved ? 'line-through' : ''}">
										{nodeData.node.title}
									</span>
									<span
										class="rounded-md border border-black bg-white px-1.5 py-0.5 text-xs font-medium text-black {isResolved
											? 'opacity-75'
											: ''}"
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
											{@const personResult = peopleService?.getPerson(task.assignee)}
											{#await personResult instanceof Promise ? personResult : Promise.resolve(personResult) then person}
												{@const overdue = task.dueDate && isOverdue(task.dueDate)}

												<div
													class="group rounded-md border border-black bg-white p-3 transition-colors {isResolved
														? 'opacity-75'
														: ''}"
												>
													<div class="flex items-start justify-between gap-3">
														<div class="min-w-0 flex-1">
															<!-- Task info -->
															<div class="mb-2 flex items-start justify-between gap-2">
																<h4
																	class="font-medium text-black {isResolved ? 'line-through' : ''}"
																>
																	{task.title}
																</h4>
																{#if showActions}
																	<div class="flex items-center gap-1">
																		{#if !isResolved}
																			<button
																				onclick={() => onResolveTask?.(task)}
																				class="rounded-full p-1 opacity-0 transition-all group-hover:opacity-100"
																				title="Mark as resolved"
																			>
																				<CheckCircle
																					class="h-3.5 w-3.5 text-zinc-500 hover:text-green-500"
																				/>
																			</button>
																		{:else}
																			<button
																				onclick={() => onReactivateTask?.(task)}
																				class="rounded-full p-1 opacity-0 transition-all group-hover:opacity-100"
																				title="Reactivate task"
																			>
																				<RotateCcw
																					class="h-3.5 w-3.5 text-zinc-500 hover:text-borg-orange"
																				/>
																			</button>
																		{/if}
																		<button
																			onclick={() => onDeleteTask?.(task)}
																			class="rounded-full p-1 opacity-0 transition-all group-hover:opacity-100"
																			title="Delete task permanently"
																		>
																			<Trash2
																				class="h-3.5 w-3.5 text-zinc-500 hover:text-rose-500"
																			/>
																		</button>
																	</div>
																{/if}
															</div>

															<!-- Assignee and meta info -->
															<div class="flex items-center gap-4 text-xs text-zinc-500">
																{#if peopleService}
																	<span
																		class="rounded-full bg-borg-orange px-2 py-[0.15rem] text-white {isResolved
																			? 'opacity-75'
																			: ''}">{person?.name || 'Unassigned'}</span
																	>
																{/if}

																{#if task.dueDate}
																	<div
																		class="flex items-center gap-1 {overdue ? 'text-rose-400' : ''}"
																	>
																		<Calendar class="h-3 w-3" />
																		<span>Due {formatDate(task.dueDate)}</span>
																		{#if overdue && !isResolved}
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

																{#if isResolved}
																	<div class="flex items-center gap-1 text-green-600">
																		<CheckCircle class="h-3 w-3" />
																		<span>Resolved</span>
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
