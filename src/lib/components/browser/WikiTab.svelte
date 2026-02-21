<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, FileText, Trash2, ExternalLink, Search } from '@lucide/svelte';
	import type { IWikiService } from '../../services/interfaces/IWikiService';
	import type { WikiEntry } from '../../types/wiki';

	let { wikiService, activeTab } = $props<{
		wikiService: IWikiService;
		activeTab: string;
	}>();

	let wikis = $state<WikiEntry[]>([]);
	let loading = $state(true);
	let deletingWikis = $state<Set<string>>(new Set());
	let subscriptionCleanup: (() => void) | null = null;
	let searchQuery = $state('');

	// Filter wikis based on search query
	let filteredWikis = $derived(
		wikis.filter(
			(wiki) =>
				wiki.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				wiki.content.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	onMount(() => {
		loadWikis();

		return () => {
			if (subscriptionCleanup) {
				subscriptionCleanup();
			}
		};
	});

	// Reload when tab becomes active
	$effect(() => {
		if (activeTab === 'wiki') {
			loadWikis();
		}
	});

	async function loadWikis() {
		loading = true;

		// Try to subscribe for real-time updates
		if ((wikiService as any).subscribeToAllEntries) {
			if (subscriptionCleanup) {
				subscriptionCleanup();
			}
			subscriptionCleanup = (wikiService as any).subscribeToAllEntries((entries: WikiEntry[]) => {
				wikis = entries;
				loading = false;
			});
		} else {
			wikis = await wikiService.getAllEntries();
			loading = false;
		}
	}

	async function handleCreateWiki() {
		const newWiki = await wikiService.create({
			title: 'Untitled Wiki',
			content: ''
		});
		// Open in new tab
		window.open(`/wiki/${newWiki.id}`, '_blank');
	}

	async function handleDeleteWiki(event: MouseEvent, wiki: WikiEntry) {
		event.stopPropagation();

		if (confirm(`Are you sure you want to delete "${wiki.title}"? This action cannot be undone.`)) {
			deletingWikis.add(wiki.id);
			deletingWikis = new Set(deletingWikis);

			try {
				await wikiService.deleteEntry(wiki.id);
				// If not using real-time subscription, reload manually
				if (!(wikiService as any).subscribeToAll) {
					await loadWikis();
				}
			} finally {
				deletingWikis.delete(wiki.id);
				deletingWikis = new Set(deletingWikis);
			}
		}
	}

	function handleOpenWiki(wikiId: string) {
		window.open(`/wiki/${wikiId}`, '_blank');
	}

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString();
	}
</script>

<div class="flex h-full w-full flex-col overflow-hidden">
	<!-- Sticky toolbar -->
	<div class="flex w-full flex-shrink-0 items-center gap-2 border-b border-borg-brown bg-borg-beige px-4 py-2">
		<div class="relative">
			<Search class="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
			<input
				type="text"
				placeholder="Search wikis..."
				bind:value={searchQuery}
				class="w-52 rounded border border-zinc-300 bg-white py-1.5 pr-3 pl-8 text-sm outline-none focus:border-zinc-400"
			/>
		</div>
		<button
			onclick={handleCreateWiki}
			class="flex items-center gap-1.5 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50"
		>
			<Plus class="h-3.5 w-3.5" />
			New Wiki
		</button>
	</div>

	<!-- Content Area -->
	<div class="flex-1 overflow-y-auto p-4">
		{#if loading}
			<div class="flex h-64 items-center justify-center">
				<div class="h-6 w-6 animate-spin rounded-full border-2 border-black border-t-transparent"></div>
			</div>
		{:else if wikis.length === 0}
			<div class="flex h-64 flex-col items-center justify-center text-center">
				<FileText class="mb-4 h-8 w-8 text-zinc-300" />
				<h3 class="mb-2 text-lg font-medium text-black">No wiki pages yet</h3>
				<p class="mb-4 text-sm text-zinc-500">Create your first wiki page to get started</p>
				<button
					onclick={handleCreateWiki}
					class="flex items-center gap-2 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
				>
					<Plus class="h-3.5 w-3.5" />
					Create Wiki
				</button>
			</div>
		{:else if filteredWikis.length === 0}
			<div class="flex h-64 flex-col items-center justify-center text-center">
				<Search class="mb-4 h-8 w-8 text-zinc-300" />
				<h3 class="mb-2 text-lg font-medium text-black">No results found</h3>
				<p class="text-sm text-zinc-500">Try a different search term</p>
			</div>
		{:else}
			<div class="space-y-1">
				{#each filteredWikis as wiki}
					{@const isDeleting = deletingWikis.has(wiki.id)}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="group flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 transition-colors hover:bg-borg-beige {isDeleting ? 'pointer-events-none opacity-50' : ''}"
						onclick={() => !isDeleting && handleOpenWiki(wiki.id)}
					>
						<div class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded border border-blue-200 bg-blue-50">
							<FileText class="h-3.5 w-3.5 text-blue-500" />
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-zinc-800">{wiki.title}</p>
							<p class="text-xs text-zinc-400">Updated {formatDate(wiki.updatedAt)}</p>
						</div>
						<div class="flex flex-shrink-0 items-center gap-1">
							<button
								onclick={(e) => { e.stopPropagation(); handleOpenWiki(wiki.id); }}
								aria-label="Open in new tab"
								class="rounded p-1 text-zinc-300 transition-colors hover:text-zinc-600"
							>
								<ExternalLink class="h-3.5 w-3.5" />
							</button>
							<button
								onclick={(e) => !isDeleting && handleDeleteWiki(e, wiki)}
								aria-label="Delete wiki"
								disabled={isDeleting}
								class="rounded p-1 text-zinc-300 transition-colors hover:text-red-400 disabled:cursor-not-allowed"
							>
								{#if isDeleting}
									<div class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent"></div>
								{:else}
									<Trash2 class="h-3.5 w-3.5" />
								{/if}
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
