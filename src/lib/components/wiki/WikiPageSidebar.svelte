<script lang="ts">
	import { FileText, Search } from '@lucide/svelte';
	import { ServiceFactory } from '$lib/services/ServiceFactory';
	import type { WikiEntry } from '$lib/types/wiki';

	interface Props {
		currentWikiId: string;
		onClose: () => void;
		onSelect: (pageId: string) => void;
	}

	let { currentWikiId, onClose, onSelect }: Props = $props();

	const wikiService = ServiceFactory.createWikiService();
	let pages = $state<WikiEntry[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');

	$effect(() => {
		(async () => {
			loading = true;
			const result = wikiService.getAllEntries();
			const allPages = result instanceof Promise ? await result : result;
			pages = allPages.filter((p) => p.id !== currentWikiId);
			loading = false;
		})();
	});

	const filteredPages = $derived(
		pages.filter((p) =>
			p.title.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	function handleSelect(pageId: string) {
		onSelect(pageId);
	}
</script>

<div class="flex h-full flex-col bg-white">
	<!-- Search -->
	<div class="shrink-0 border-b border-zinc-200 p-2">
		<div class="flex items-center gap-1">
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search pages..."
				class="min-w-0 flex-1 rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs text-black placeholder-zinc-400 outline-none focus:border-zinc-400"
			/>
		</div>
	</div>

	<!-- Pages list -->
	<div class="flex-1 overflow-y-auto">
		{#if loading}
			<div class="flex items-center justify-center py-8">
				<div class="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-black"></div>
			</div>
		{:else if filteredPages.length === 0}
			<p class="p-4 text-center text-xs text-zinc-400">
				{searchQuery ? 'No pages found' : 'No other pages available'}
			</p>
		{:else}
			{#each filteredPages as page}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					onclick={() => handleSelect(page.id)}
					class="flex cursor-pointer items-center gap-2 border-b border-zinc-100 px-3 py-2 text-xs hover:bg-zinc-50"
				>
					<FileText class="h-3 w-3 shrink-0 text-zinc-400" />
					<span class="truncate text-zinc-700">{page.title || 'Untitled'}</span>
					<span class="ml-auto shrink-0 text-zinc-400" style="font-size:10px">
						{#if page.updatedAt}
							{new Date(page.updatedAt).toLocaleDateString()}
						{:else}
							{new Date(page.createdAt).toLocaleDateString()}
						{/if}
					</span>
				</div>
			{/each}
		{/if}
	</div>
</div>
