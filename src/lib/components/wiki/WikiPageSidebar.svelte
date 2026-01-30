<script lang="ts">
	import { X, FileText, Search } from '@lucide/svelte';
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
			// Filter out current page
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

<div class="flex h-full w-80 flex-col border-l border-black bg-borg-white">
	<!-- Header -->
	<div class="flex h-14 shrink-0 items-center justify-between border-b border-black px-4">
		<h3 class="font-semibold">Link Page</h3>
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
				placeholder="Search pages..."
				class="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
			/>
		</div>
	</div>

	<!-- Pages list -->
	<div class="flex-1 overflow-y-auto p-3">
		{#if loading}
			<div class="flex items-center justify-center py-8">
				<div class="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-black"></div>
			</div>
		{:else if filteredPages.length === 0}
			<div class="py-8 text-center text-sm text-zinc-500">
				{searchQuery ? 'No pages found' : 'No other pages available'}
			</div>
		{:else}
			<div class="space-y-2">
				{#each filteredPages as page}
					<button
						onclick={() => handleSelect(page.id)}
						class="flex w-full items-center gap-3 rounded-lg border border-black bg-white p-3 text-left transition-colors hover:bg-borg-beige/30"
					>
						<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-black/20 bg-borg-beige/50">
							<FileText class="h-4 w-4 text-black" />
						</div>
						<div class="min-w-0 flex-1">
							<div class="truncate text-sm font-medium text-black">{page.title || 'Untitled'}</div>
							<div class="text-xs text-zinc-500">
								{#if page.updatedAt}
									Updated {new Date(page.updatedAt).toLocaleDateString()}
								{:else}
									Created {new Date(page.createdAt).toLocaleDateString()}
								{/if}
							</div>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>
