<script lang="ts">
	import { X, Folder, Search } from '@lucide/svelte';
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

<div class="flex h-full w-80 flex-col border-l border-black bg-borg-white">
	<!-- Header -->
	<div class="flex h-14 shrink-0 items-center justify-between border-b border-black px-4">
		<h3 class="font-semibold">Link Project</h3>
		<button onclick={onClose} class="rounded p-1 hover:bg-borg-beige">
			<X class="h-5 w-5" />
		</button>
	</div>

	<!-- Search -->
	<div class="border-b border-black p-3">
		<div class="flex items-center gap-2 rounded-lg border border-black bg-white px-3 py-2">
			<Search class="h-4 w-4 text-zinc-400" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search projects..."
				class="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
			/>
		</div>
	</div>

	<!-- Projects list -->
	<div class="flex-1 overflow-y-auto p-3">
		{#if loading}
			<div class="flex items-center justify-center py-8">
				<div class="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-black"></div>
			</div>
		{:else if filteredProjects.length === 0}
			<div class="py-8 text-center text-sm text-zinc-500">
				{searchQuery ? 'No projects found' : 'No projects available'}
			</div>
		{:else}
			<div class="space-y-2">
				{#each filteredProjects as project}
					<button
						onclick={() => handleSelect(project.slug)}
						class="flex w-full items-center gap-3 rounded-lg border border-black bg-white p-3 text-left transition-colors hover:bg-borg-beige/30"
					>
						<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-black/20 bg-borg-beige/50">
							<Folder class="h-4 w-4 text-black" />
						</div>
						<div class="min-w-0 flex-1">
							<div class="truncate text-sm font-medium text-black">{project.title || 'Untitled'}</div>
							<div class="text-xs text-zinc-500">{project.slug}</div>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>
