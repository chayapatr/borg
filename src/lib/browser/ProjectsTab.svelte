<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { ProjectsService } from '../services/ProjectsService';
	import CreateProjectModal from './CreateProjectModal.svelte';

	let projectsService: ProjectsService;
	let projects = $state<any[]>([]);
	let showCreateModal = $state(false);

	onMount(() => {
		projectsService = new ProjectsService();
		loadProjects();
	});

	function loadProjects() {
		projects = projectsService.getAllProjects();
	}

	// Listen for project updates when returning from project pages
	function handleVisibilityChange() {
		if (!document.hidden) {
			loadProjects();
		}
	}

	function handleCreateProject(projectData: any) {
		const project = projectsService.createProject(projectData);
		projects = projectsService.getAllProjects();
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

	function handleDeleteProject(event: MouseEvent, slug: string, title: string) {
		event.stopPropagation(); // Prevent opening the project
		
		if (confirm(`Are you sure you want to delete the project "${title}"? This action cannot be undone.`)) {
			const success = projectsService.deleteProject(slug);
			if (success) {
				projects = projectsService.getAllProjects();
			}
		}
	}
</script>

<svelte:document on:visibilitychange={handleVisibilityChange} />

<div class="flex-1 flex flex-col">
	<!-- Header -->
	<div class="p-6 border-b border-zinc-800">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-2xl font-semibold text-zinc-100">Projects</h2>
				<p class="text-zinc-400 mt-1">Manage your research projects</p>
			</div>
			<button
				onclick={() => (showCreateModal = true)}
				class="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
				</svg>
				New Project
			</button>
		</div>
	</div>

	<!-- Projects Grid -->
	<div class="flex-1 p-6 overflow-y-auto">
		{#if projects.length === 0}
			<div class="flex flex-col items-center justify-center h-64 text-center">
				<div class="w-16 h-16 bg-zinc-800 rounded-lg flex items-center justify-center mb-4">
					<svg class="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
					</svg>
				</div>
				<h3 class="text-lg font-medium text-zinc-300 mb-2">No projects yet</h3>
				<p class="text-zinc-500 mb-4">Create your first project to get started</p>
				<button
					onclick={() => (showCreateModal = true)}
					class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
				>
					Create Project
				</button>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
				{#each projects as project}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="bg-zinc-900 border border-zinc-800 rounded-lg p-6 hover:border-zinc-700 transition-colors cursor-pointer"
						onclick={() => handleOpenProject(project.slug)}
					>
						<div class="flex items-start justify-between mb-4">
							<div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
								<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
								</svg>
							</div>
							<div class="flex items-center gap-2">
								<div class="text-xs text-zinc-500">
									{formatDate(project.updatedAt)}
								</div>
								<button
									onclick={(e) => handleDeleteProject(e, project.slug, project.title)}
									aria-label="Delete project"
									class="rounded p-1 text-zinc-500 hover:bg-red-500/30 hover:text-red-400 transition-colors"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
										/>
									</svg>
								</button>
							</div>
						</div>
						
						<h3 class="font-semibold text-zinc-100 mb-2 line-clamp-2">{project.title}</h3>
						<p class="text-sm text-zinc-400 mb-4 line-clamp-3">{project.description || 'No description'}</p>
						
						<div class="flex justify-end text-xs text-zinc-500">
							<span class="capitalize">{project.status || 'active'}</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

{#if showCreateModal}
	<CreateProjectModal
		onCreate={handleCreateProject}
		onClose={() => (showCreateModal = false)}
	/>
{/if}