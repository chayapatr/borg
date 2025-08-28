<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { IProjectsService, ITaskService } from '../../services/interfaces';
	import CreateProjectModal from './CreateProjectModal.svelte';
	import ProjectsCanvas from './ProjectsCanvas.svelte';
	import { Plus, FolderOpen, Trash2, Grid, Network } from '@lucide/svelte';
	import { ServiceFactory } from '../../services/ServiceFactory';
	import { authStore } from '../../stores/authStore';

	let {
		projectsService,
		cachedProjects = [],
		onCountsUpdate = () => {}
	} = $props<{
		projectsService: IProjectsService;
		cachedProjects?: any[];
		onCountsUpdate?: () => void;
	}>();

	let projects = $state<any[]>([]);
	let showCreateModal = $state(false);
	let projectCounts = $state<Record<string, { todo: number; doing: number; done: number }>>({});
	let projectTaskCounts = $state<Record<string, number>>({});
	let viewMode = $state<'list' | 'canvas'>($authStore.userType === 'collaborator' ? 'list' : 'canvas');
	let dataLoaded = $state(false);
	let updatingCounts = $state(false);
	let creatingProject = $state(false);
	let deletingProjects = $state<Set<string>>(new Set());

	let taskService: ITaskService;

	// Force collaborators to use list view only
	$effect(() => {
		if ($authStore.userType === 'collaborator') {
			viewMode = 'list';
		}
	});

	onMount(() => {
		taskService = ServiceFactory.createTaskService();
		loadProjects();
	});

	async function loadProjects(force = false) {
		if (dataLoaded && !force) return; // Prevent duplicate loading unless forced

		// Use cached projects if available, otherwise fetch (unless forced)
		if (cachedProjects.length > 0 && !force) {
			projects = cachedProjects;
		} else {
			projects = await projectsService.getAllProjects();
		}

		await updateProjectCounts();
		dataLoaded = true;
	}

	async function updateProjectCounts() {
		if (updatingCounts) return; // Prevent concurrent updates

		updatingCounts = true;
		try {
			const counts: Record<string, { todo: number; doing: number; done: number }> = {};
			const taskCounts: Record<string, number> = {};

			for (const project of projects) {
				// Get node status counts (todo/doing/done)
				counts[project.slug] = await projectsService.getProjectStatusCounts(project.slug);

				// Get task counts
				const projectTaskCount = await taskService.getTaskCounts(project.slug);
				taskCounts[project.slug] = projectTaskCount.total;
			}

			projectCounts = counts;
			projectTaskCounts = taskCounts;
			onCountsUpdate(); // Notify parent to update global counts
		} finally {
			updatingCounts = false;
		}
	}

	// Listen for project updates when returning from project pages
	function handleVisibilityChange() {
		if (!document.hidden) {
			// Invalidate caches and force refresh when returning from project pages
			projectsService.invalidateAllStatusCaches();
			loadProjects(true);
		}
	}

	async function handleCreateProject(projectData: any) {
		creatingProject = true;
		try {
			const project = await projectsService.createProject(projectData);
			await loadProjects(true); // Force reload to get new project
			showCreateModal = false;

			// Navigate to the new project
			// goto(`/project/${project.slug}`);
		} finally {
			creatingProject = false;
		}
	}

	function handleOpenProject(slug: string) {
		// Both members and collaborators can access project pages
		// The canvas restriction is handled within the project page itself
		goto(`/project/${slug}`);
	}

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString();
	}

	async function handleDeleteProject(event: MouseEvent, slug: string, title: string) {
		event.stopPropagation(); // Prevent opening the project

		if (
			confirm(
				`Are you sure you want to delete the project "${title}"? This action cannot be undone.`
			)
		) {
			// Add project to deleting set
			deletingProjects.add(slug);
			deletingProjects = new Set(deletingProjects);

			try {
				const success = await projectsService.deleteProject(slug);
				if (success) {
					await loadProjects(true); // Force reload to refresh UI
				}
			} finally {
				// Remove project from deleting set
				deletingProjects.delete(slug);
				deletingProjects = new Set(deletingProjects);
			}
		}
	}
</script>

<svelte:document on:visibilitychange={handleVisibilityChange} />

<div class="flex flex-1 flex-col">
	<!-- Header -->
	<div class=" flex h-16 flex-col justify-center border-b bg-white px-6">
		<div class="flex items-center justify-between">
			<div>
				<div class="flex items-center gap-3">
					<FolderOpen class="h-8 w-8" />
					<h2 class="rounded-md text-3xl font-semibold">Projects</h2>
				</div>
				<!-- <p class="text-zinc-400 mt-1">Manage your research projects</p> -->
			</div>
			<div class="flex items-center gap-4">
				<!-- View Toggle (hidden for collaborators) -->
				{#if $authStore.userType !== 'collaborator'}
					<div
						class="flex h-10 items-center divide-x divide-black rounded-full border border-black bg-white"
					>
						<button
							onclick={() => (viewMode = 'canvas')}
							class="flex h-full items-center gap-2 rounded-full rounded-r-2xl px-3 py-1 text-sm transition-colors {viewMode ===
							'canvas'
								? 'bg-borg-brown text-black'
								: 'text-black hover:bg-borg-beige'}"
						>
							<Network class="h-4 w-4" />
							Canvas
						</button>
						<button
							onclick={() => (viewMode = 'list')}
							class="flex h-full items-center gap-2 rounded-full rounded-l-2xl px-3 py-1 text-sm transition-colors {viewMode ===
							'list'
								? 'bg-borg-brown text-black'
								: 'text-black hover:bg-borg-beige'}"
						>
							<Grid class="h-4 w-4" />
							List
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Content Area -->
	<div class={viewMode === 'canvas' ? 'min-h-0 flex-1' : 'flex-1 overflow-y-auto p-6'}>
		{#if viewMode === 'list'}
			<!-- List View -->
			{#if projects.length === 0}
				<div class="flex h-64 flex-col items-center justify-center text-center">
					<FolderOpen class="mb-4 h-8  w-8 text-black" />
					<h3 class="mb-2 text-lg font-medium text-black">No projects yet</h3>
					<p class="mb-4 text-zinc-500">Create your first project to get started</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{#each projects.filter((p) => p.id !== 'project-canvas') as project}
						{@const isDeleting = deletingProjects.has(project.slug)}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="box-shadow-black rounded-sm border border-black bg-white p-4 transition-colors hover:bg-borg-beige {isDeleting ? 'opacity-50 pointer-events-none' : ''}"
							onclick={() => !isDeleting && handleOpenProject(project.slug)}
						>
							<div class="mb-4 flex items-start justify-between">
								<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-borg-violet">
									<FolderOpen class="h-5 w-5 text-white" />
								</div>
								<div class="flex items-center gap-2">
									<button
										onclick={(e) => !isDeleting && handleDeleteProject(e, project.slug, project.title)}
										aria-label="Move to recycle bin"
										disabled={isDeleting}
										class="rounded p-1 text-zinc-500 transition-colors hover:bg-borg-orange hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{#if isDeleting}
											<div class="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent"></div>
										{:else}
											<Trash2 class="h-4 w-4" />
										{/if}
									</button>
								</div>
							</div>

							<h3 class="mb-2 line-clamp-2 text-xl font-semibold">{project.title}</h3>

							<!-- Task Counts -->
							<div class="mb-3 text-xs text-zinc-600">
								{#if updatingCounts && !projectCounts[project.slug] && !projectTaskCounts[project.slug]}
									<div class="animate-pulse">Task: Loading...</div>
								{:else}
									{@const taskCount = projectTaskCounts[project.slug] || 0}
									{@const counts = projectCounts[project.slug] || { todo: 0, doing: 0, done: 0 }}
									Task: {taskCount} |
									<span class="inline-flex items-center gap-1">
										<span class="h-2 w-2 rounded-full border border-black bg-purple-500"></span>
										{counts.todo}
									</span>
									<span class="inline-flex items-center gap-1">
										<span class="h-2 w-2 rounded-full border border-black bg-sky-500"></span>
										{counts.doing}
									</span>
									<span class="inline-flex items-center gap-1">
										<span class="h-2 w-2 rounded-full border border-black bg-green-500"></span>
										{counts.done}
									</span>
								{/if}
							</div>

							<div class="flex justify-end text-xs text-zinc-500">
								<div class="capitalize">
									{project.status || 'active'} | {formatDate(project.updatedAt)}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{:else}
			<!-- Canvas View -->
			<div class="h-full w-full">
				<ProjectsCanvas
					projects={projects.filter((p) => p.id !== 'project-canvas')}
					onProjectClick={handleOpenProject}
					onProjectUpdate={loadProjects}
					onCreateProject={() => (showCreateModal = true)}
				/>
			</div>
		{/if}
	</div>
</div>

{#if showCreateModal}
	<CreateProjectModal onCreate={handleCreateProject} onClose={() => (showCreateModal = false)} isLoading={creatingProject} />
{/if}
