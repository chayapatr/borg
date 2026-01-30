<script lang="ts">
	import { Folder, X } from '@lucide/svelte';
	import { ServiceFactory } from '$lib/services/ServiceFactory';
	import type { Project } from '$lib/types/project';

	interface Props {
		projectSlug: string;
		onSelect: () => void;
		onDelete?: () => void;
	}

	let { projectSlug, onSelect, onDelete }: Props = $props();

	const projectsService = ServiceFactory.createProjectsService();
	let project = $state<Project | null>(null);
	let loading = $state(true);

	$effect(() => {
		(async () => {
			loading = true;
			const result = projectsService.getProject(projectSlug);
			project = result instanceof Promise ? await result : result;
			loading = false;
		})();
	});
</script>

<div class="group inline-flex items-center gap-1">
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<span
		class="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-black underline decoration-black/30 underline-offset-2 transition-colors hover:decoration-black"
		onclick={onSelect}
	>
		<Folder class="h-4 w-4" />
		{#if loading}
			<span class="text-zinc-400">Loading...</span>
		{:else if project}
			{project.title || 'Untitled'}
		{:else}
			<span class="text-red-600">Project not found</span>
		{/if}
	</span>

	{#if onDelete}
		<button
			class="ml-1 rounded p-0.5 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-200 hover:text-zinc-600 group-hover:opacity-100"
			onclick={(e) => { e.stopPropagation(); onDelete(); }}
		>
			<X class="h-3.5 w-3.5" />
		</button>
	{/if}
</div>
