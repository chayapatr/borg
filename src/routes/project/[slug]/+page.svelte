<script lang="ts">
	import Canvas from '$lib/Canvas.svelte';
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { ProjectsService } from '$lib/services/ProjectsService';
	import { goto } from '$app/navigation';

	const projectSlug = $derived($page.params.slug);
	let projectsService: ProjectsService;
	let project = $state<any>(null);
	let loading = $state(true);

	onMount(async () => {
		projectsService = new ProjectsService();
		loadProject();
	});

	function loadProject() {
		project = projectsService.getProject(projectSlug);
		
		if (!project) {
			// Project not found, redirect to home
			goto('/');
			return;
		}
		
		loading = false;
	}

	// Refresh project data periodically to show updated node count
	$effect(() => {
		if (projectSlug && projectsService && !loading) {
			const interval = setInterval(() => {
				const updatedProject = projectsService.getProject(projectSlug);
				if (updatedProject) {
					project = updatedProject;
				}
			}, 2000);

			return () => clearInterval(interval);
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
	<div class="h-screen w-full bg-zinc-950 flex items-center justify-center">
		<div class="text-center">
			<div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
			<p class="text-zinc-400">Loading project...</p>
		</div>
	</div>
{:else if project}
	<div class="h-screen w-full flex flex-col">
		<!-- Project Header -->
		<div class="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
			<div class="flex items-center gap-4">
				<button
					onclick={handleBackToBrowser}
					class="flex items-center gap-2 text-zinc-400 hover:text-zinc-300 transition-colors"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
					</svg>
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
			<div class="flex items-center gap-2 text-sm text-zinc-500">
				<span class="capitalize">{project.status}</span>
			</div>
		</div>

		<!-- Canvas -->
		<div class="flex-1">
			<SvelteFlowProvider>
				<Canvas {projectSlug} />
			</SvelteFlowProvider>
		</div>
	</div>
{/if}