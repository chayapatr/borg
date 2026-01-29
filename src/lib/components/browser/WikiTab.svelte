<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, FileText, Trash2, ExternalLink, Search } from '@lucide/svelte';
	import type { IWikiService } from '../../services/interfaces/IWikiService';
	import type { WikiEntry } from '../../types/wiki';

	let {
		wikiService,
		activeTab
	} = $props<{
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

<div class="flex flex-1 flex-col">
	<!-- Header -->
	<div class="flex h-16 flex-col justify-center border-b bg-white px-6">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-3">
				<FileText class="h-8 w-8" />
				<h2 class="rounded-md text-3xl font-semibold">Wiki</h2>
			</div>
			<div class="flex items-center gap-4">
				<!-- Search bar -->
				<div class="relative">
					<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
					<input
						type="text"
						placeholder="Search wikis..."
						bind:value={searchQuery}
						class="w-64 rounded-lg border border-black py-2 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-black"
					/>
				</div>
				<button
					onclick={handleCreateWiki}
					class="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
				>
					<Plus class="h-4 w-4" />
					New Wiki
				</button>
			</div>
		</div>
	</div>

	<!-- Content Area -->
	<div class="flex-1 overflow-y-auto p-6">
		{#if loading}
			<div class="flex h-64 items-center justify-center">
				<div class="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent"></div>
			</div>
		{:else if wikis.length === 0}
			<div class="flex h-64 flex-col items-center justify-center text-center">
				<FileText class="mb-4 h-8 w-8 text-black" />
				<h3 class="mb-2 text-lg font-medium text-black">No wiki pages yet</h3>
				<p class="mb-4 text-zinc-500">Create your first wiki page to get started</p>
				<button
					onclick={handleCreateWiki}
					class="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
				>
					<Plus class="h-4 w-4" />
					Create Wiki
				</button>
			</div>
		{:else if filteredWikis.length === 0}
			<div class="flex h-64 flex-col items-center justify-center text-center">
				<Search class="mb-4 h-8 w-8 text-zinc-400" />
				<h3 class="mb-2 text-lg font-medium text-black">No results found</h3>
				<p class="text-zinc-500">Try a different search term</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each filteredWikis as wiki}
					{@const isDeleting = deletingWikis.has(wiki.id)}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="box-shadow-black rounded-sm border border-black bg-white p-4 transition-colors hover:bg-borg-beige {isDeleting ? 'opacity-50 pointer-events-none' : ''}"
						onclick={() => !isDeleting && handleOpenWiki(wiki.id)}
					>
						<div class="mb-4 flex items-start justify-between">
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500">
								<FileText class="h-5 w-5 text-white" />
							</div>
							<div class="flex items-center gap-2">
								<button
									onclick={(e) => {
										e.stopPropagation();
										handleOpenWiki(wiki.id);
									}}
									aria-label="Open in new tab"
									class="rounded p-1 text-zinc-500 transition-colors hover:bg-borg-orange hover:text-white"
								>
									<ExternalLink class="h-4 w-4" />
								</button>
								<button
									onclick={(e) => !isDeleting && handleDeleteWiki(e, wiki)}
									aria-label="Delete wiki"
									disabled={isDeleting}
									class="rounded p-1 text-zinc-500 transition-colors hover:bg-borg-orange hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{#if isDeleting}
										<div class="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent"></div>
									{:else}
										<Trash2 class="h-4 w-4" />
									{/if}
								</button>
							</div>
						</div>

						<h3 class="mb-2 line-clamp-2 text-xl font-semibold">{wiki.title}</h3>

						{#if wiki.content}
							<p class="mb-3 line-clamp-2 text-sm text-zinc-600">
								{wiki.content.slice(0, 100)}{wiki.content.length > 100 ? '...' : ''}
							</p>
						{/if}

						<div class="flex justify-end text-xs text-zinc-500">
							<div>
								Updated {formatDate(wiki.updatedAt)}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
