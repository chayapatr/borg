<script lang="ts">
	import { page } from '$app/stores';
	import { ChevronLeft } from '@lucide/svelte';
	import WikiEntryView from '$lib/components/wiki/WikiEntryView.svelte';

	const wikiId = $derived($page.params.id);
</script>

<svelte:head>
	<title>Wiki | BORG</title>
</svelte:head>

<div class="relative flex h-screen w-full flex-col bg-white">
	<!-- Thin top bar with just the logo -->
	<div class="flex h-12 shrink-0 items-center gap-1 border-b border-zinc-200 bg-white px-3">
		<a href="/"><img src="/BORG.svg" class="h-5" alt="BORG" /></a>
	</div>

	<!-- Floating back button -->
	<div class="absolute left-3 top-[calc(3rem+0.75rem)] z-10">
		<a
			href="/"
			class="flex items-center gap-1 rounded-md border border-zinc-200 bg-white/80 px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
		>
			<ChevronLeft class="h-3.5 w-3.5" />
			Wiki
		</a>
	</div>

	{#if wikiId}
		<WikiEntryView {wikiId} />
	{/if}
</div>
