<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { ServiceFactory } from '../../services/ServiceFactory';
	import type { IProjectsService } from '../../services/interfaces';
	import CreateProjectModal from './CreateProjectModal.svelte';
	import ProjectsCanvas from './ProjectsCanvas.svelte';
	import { Plus, FolderOpen, Trash2, Grid, Network } from '@lucide/svelte';

	let { onCountsUpdate = () => {} } = $props<{ onCountsUpdate?: () => void }>();

	let projectsService: IProjectsService;
	let projects = $state<any[]>([]);
	let showCreateModal = $state(false);
	let projectCounts = $state<Record<string, { todo: number; doing: number; done: number }>>({});
	let viewMode = $state<'list' | 'canvas'>('list');

	onMount(() => {
		projectsService = ServiceFactory.createProjectsService();
		loadProjects();
	});

	async function loadProjects() {
		projects = await projectsService.getAllProjects();
		await updateProjectCounts();
	}

	async function updateProjectCounts() {
		const counts: Record<string, { todo: number; doing: number; done: number }> = {};
		for (const project of projects) {
			counts[project.slug] = await projectsService.getProjectStatusCounts(project.slug);
		}
		projectCounts = counts;
		onCountsUpdate(); // Notify parent to update global counts
	}

	// Listen for project updates when returning from project pages
	function handleVisibilityChange() {
		if (!document.hidden) {
			loadProjects();
		}
	}

	async function handleCreateProject(projectData: any) {
		const project = await projectsService.createProject(projectData);
		projects = await projectsService.getAllProjects();
		showCreateModal = false;

		// Navigate to the new project
		goto(`/project/${project.slug}`);
	}

	function handleOpenProject(slug: string) {
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
			const success = await projectsService.deleteProject(slug);
			if (success) {
				await loadProjects(); // This will also update counts
			}
		}
	}
</script>

<svelte:document on:visibilitychange={handleVisibilityChange} />

<div class="flex flex-1 flex-col">
	<!-- Header -->
	<div class=" border-b bg-white px-6 py-4">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="rounded-md text-4xl font-semibold">🏕️ Projects</h2>
				<!-- <p class="text-zinc-400 mt-1">Manage your research projects</p> -->
			</div>
			<div class="flex items-center gap-4">
				<!-- View Toggle -->
				<div class="flex items-center rounded-lg border border-black bg-white p-1">
					<button
						onclick={() => (viewMode = 'list')}
						class="flex items-center gap-2 rounded px-3 py-1 text-sm transition-colors {viewMode ===
						'list'
							? 'bg-borg-violet text-white'
							: 'text-black hover:bg-borg-beige'}"
					>
						<Grid class="h-4 w-4" />
						List
					</button>
					<button
						onclick={() => (viewMode = 'canvas')}
						class="flex items-center gap-2 rounded px-3 py-1 text-sm transition-colors {viewMode ===
						'canvas'
							? 'bg-borg-violet text-white'
							: 'text-black hover:bg-borg-beige'}"
					>
						<Network class="h-4 w-4" />
						Canvas
					</button>
				</div>
				<button
					onclick={() => (showCreateModal = true)}
					class="transition- flex items-center gap-2 rounded-full border border-white bg-borg-violet px-4 py-2 text-white transition-all hover:cursor-pointer hover:bg-black
					"
				>
					<Plus class="h-4 w-4" />
					New Project
				</button>
			</div>
		</div>
	</div>

	<!-- Content Area -->
	<div class="{viewMode === 'canvas' ? 'flex-1 min-h-0' : 'flex-1 overflow-y-auto p-6'}">
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
					{#each projects as project}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="box-shadow-black rounded-sm border border-black bg-white p-4 transition-colors hover:bg-borg-beige"
							onclick={() => handleOpenProject(project.slug)}
						>
							<div class="mb-4 flex items-start justify-between">
								<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-borg-violet">
									<FolderOpen class="h-5 w-5 text-white" />
								</div>
								<div class="flex items-center gap-2">
									<button
										onclick={(e) => handleDeleteProject(e, project.slug, project.title)}
										aria-label="Delete project"
										class="rounded p-1 text-zinc-500 transition-colors hover:bg-borg-orange hover:text-white"
									>
										<Trash2 class="h-4 w-4" />
									</button>
								</div>
							</div>

							<h3 class="mb-2 line-clamp-2 text-xl font-semibold">{project.title}</h3>

							<!-- Status Counts -->
							{#if projectCounts[project.slug]}
								<div class="mb-3 flex items-center gap-2">
									<div class="flex items-center gap-1">
										<span class="h-2 w-2 rounded-full border border-black bg-sky-500"></span>
										<span class="text-xs">{projectCounts[project.slug].todo}</span>
									</div>
									<div class="flex items-center gap-1">
										<span class="h-2 w-2 rounded-full border border-black bg-purple-500"></span>
										<span class="text-xs">{projectCounts[project.slug].doing}</span>
									</div>
									<div class="flex items-center gap-1">
										<span class="h-2 w-2 rounded-full border border-black bg-green-500"></span>
										<span class="text-xs">{projectCounts[project.slug].done}</span>
									</div>
								</div>
							{/if}

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
					{projects}
					onProjectClick={handleOpenProject}
					onProjectUpdate={loadProjects}
				/>
			</div>
		{/if}
	</div>
</div>

{#if showCreateModal}
	<CreateProjectModal onCreate={handleCreateProject} onClose={() => (showCreateModal = false)} />
{/if}
