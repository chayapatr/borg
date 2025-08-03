<script lang="ts">
	import Canvas from '$lib/components/Canvas.svelte';
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { ServiceFactory } from '$lib/services/ServiceFactory';
	import type { IProjectsService, ITaskService } from '$lib/services/interfaces';
	import { goto } from '$app/navigation';
	import { ChevronLeft, CheckSquare } from '@lucide/svelte';
	import type { TaskWithContext } from '$lib/types/task';
	import TaskSidebar from '$lib/components/tasks/TaskSidebar.svelte';

	const projectSlug = $derived($page.params.slug);
	let projectsService: IProjectsService;
	let taskService: ITaskService;
	let project = $state<any>(null);
	let loading = $state(true);
	let statusCounts = $state({ todo: 0, doing: 0, done: 0 });
	let showTaskSidebar = $state(false);
	let projectTasks = $state<TaskWithContext[]>([]);
	let taskSubscriptionCleanup: (() => void) | null = null;

	onMount(async () => {
		projectsService = ServiceFactory.createProjectsService();
		taskService = ServiceFactory.createTaskService();
		await loadProject();
	});

	// Cleanup on component destroy
	$effect(() => {
		return () => {
			if (taskSubscriptionCleanup) {
				taskSubscriptionCleanup();
				taskSubscriptionCleanup = null;
			}
		};
	});

	async function loadProject() {
		if (!projectSlug) return;
		const projectResult = await projectsService.getProject(projectSlug);
		project = projectResult;

		if (!project) {
			// Project not found, redirect to home
			goto('/');
			return;
		}

		await updateStatusCounts();
		await loadProjectTasks();
		loading = false;
	}

	async function loadProjectTasks() {
		if (projectSlug && taskService) {
			// Clean up previous subscription if any
			if (taskSubscriptionCleanup) {
				taskSubscriptionCleanup();
				taskSubscriptionCleanup = null;
			}

			// Try to use real-time subscription if available
			if ((taskService as any).subscribeToProjectTasks) {
				console.log('Setting up real-time project task subscription');
				taskSubscriptionCleanup = (taskService as any).subscribeToProjectTasks(
					projectSlug,
					(updatedTasks: TaskWithContext[]) => {
						console.log('Real-time project tasks update:', updatedTasks.length, 'tasks');
						projectTasks = [...updatedTasks];
					}
				);
			} else {
				// Fallback to regular loading
				projectTasks = await taskService.getProjectTasks(projectSlug);
			}
		}
	}

	async function updateStatusCounts() {
		if (projectSlug && projectsService) {
			statusCounts = await projectsService.getProjectStatusCounts(projectSlug);
		}
	}

	// Refresh project data periodically to show updated node count and status counts
	$effect(() => {
		if (projectSlug && projectsService && !loading) {
			// const interval = setInterval(async () => {
			// 	const updatedProject = await projectsService.getProject(projectSlug);
			// 	if (updatedProject) {
			// 		project = updatedProject;
			// 	}
			// 	await updateStatusCounts();
			// 	await loadProjectTasks();
			// }, 2000);
			// return () => clearInterval(interval);
		}
	});

	// Handle back to browser
	function handleBackToBrowser() {
		goto('/');
	}
</script>

<svelte:head>
	<title>{project?.title || 'Project'} - Things</title>
</svelte:head>

{#if loading}
	<div class="flex h-screen w-full items-center justify-center bg-zinc-950">
		<div class="text-center">
			<div
				class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
			></div>
			<p class="text-zinc-400">Loading project...</p>
		</div>
	</div>
{:else if project}
	<div class="flex h-screen w-full flex-col">
		<!-- Project Header -->
		<div class="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6 py-4">
			<div class="flex items-center gap-4">
				<button
					onclick={handleBackToBrowser}
					class="flex items-center gap-2 text-zinc-400 transition-colors hover:text-zinc-300"
				>
					<ChevronLeft class="h-4 w-4" />
					Back to Projects
				</button>
				<div class="h-6 w-px bg-zinc-700"></div>
				<div>
					<h1 class="text-lg font-semibold text-zinc-100">{project.title}</h1>
					{#if project.description}
						<p class="text-sm text-zinc-400">{project.description}</p>
					{/if}
				</div>
			</div>
			<div class="flex items-center gap-4">
				<!-- Status Counts -->
				<div class="flex items-center gap-3">
					<div class="flex items-center gap-1">
						<span class="text-xs text-zinc-400">To Do</span>
						<span class="rounded-full bg-purple-500/20 px-2 py-1 text-xs text-purple-400"
							>{statusCounts.todo}</span
						>
					</div>
					<div class="flex items-center gap-1">
						<span class="text-xs text-zinc-400">Doing</span>
						<span class="rounded-full bg-blue-500/20 px-2 py-1 text-xs text-blue-400"
							>{statusCounts.doing}</span
						>
					</div>
					<div class="flex items-center gap-1">
						<span class="text-xs text-zinc-400">Done</span>
						<span class="rounded-full bg-green-500/20 px-2 py-1 text-xs text-green-400"
							>{statusCounts.done}</span
						>
					</div>
				</div>

				<div class="h-4 w-px bg-zinc-700"></div>

				<button
					onclick={() => (showTaskSidebar = !showTaskSidebar)}
					class="flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-zinc-100"
				>
					<CheckSquare class="h-4 w-4" />
					Tasks ({projectTasks.filter((t) => !t.resolvedAt).length})
				</button>

				<div class="h-4 w-px bg-zinc-700"></div>

				<div class="text-sm text-zinc-500">
					<span class="capitalize">{project.status}</span>
				</div>
			</div>
		</div>

		<!-- Canvas and Sidebar Container -->
		<div class="flex flex-1">
			<!-- Canvas -->
			<div class="flex-1">
				<SvelteFlowProvider>
					<Canvas {projectSlug} />
				</SvelteFlowProvider>
			</div>

			<!-- Task Sidebar -->
			{#if showTaskSidebar && projectSlug}
				<TaskSidebar
					projectSlug={projectSlug}
					{projectTasks}
					onClose={() => (showTaskSidebar = false)}
				/>
			{/if}
		</div>
	</div>
{/if}
