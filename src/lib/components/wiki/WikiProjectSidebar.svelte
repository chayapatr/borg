<script lang="ts">
	import { Folder, Search } from '@lucide/svelte';
	import { ServiceFactory } from '$lib/services/ServiceFactory';
	import type { Project } from '$lib/types/project';

	interface Props {
		onClose: () => void;
		onSelect: (projectSlug: string) => void;
	}

	let { onClose, onSelect }: Props = $props();

	const projectsService = ServiceFactory.createProjectsService();
	let projects = $state<Project[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');

	$effect(() => {
		(async () => {
			loading = true;
			const result = projectsService.getAllProjects();
			projects = result instanceof Promise ? await result : result;
			loading = false;
		})();
	});

	const filteredProjects = $derived(
		projects.filter((p) =>
			p.title.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	function handleSelect(projectSlug: string) {
		onSelect(projectSlug);
	}
</script>

<div class="flex h-full flex-col bg-white">
	<!-- Search -->
	<div class="shrink-0 border-b border-zinc-200 p-2">
		<div class="flex items-center gap-1">
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search projects..."
				class="min-w-0 flex-1 rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs text-black placeholder-zinc-400 outline-none focus:border-zinc-400"
			/>
		</div>
	</div>

	<!-- Projects list -->
	<div class="flex-1 overflow-y-auto">
		{#if loading}
			<div class="flex items-center justify-center py-8">
				<div class="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-black"></div>
			</div>
		{:else if filteredProjects.length === 0}
			<p class="p-4 text-center text-xs text-zinc-400">
				{searchQuery ? 'No projects found' : 'No projects available'}
			</p>
		{:else}
			{#each filteredProjects as project}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					onclick={() => handleSelect(project.slug)}
					class="flex cursor-pointer items-center gap-2 border-b border-zinc-100 px-3 py-2 text-xs hover:bg-zinc-50"
				>
					<Folder class="h-3 w-3 shrink-0 text-zinc-400" />
					<span class="truncate text-zinc-700">{project.title || 'Untitled'}</span>
					<span class="ml-auto shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-400" style="font-size:10px">{project.slug}</span>
				</div>
			{/each}
		{/if}
	</div>
</div>
