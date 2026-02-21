<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, FileText, Trash2, ExternalLink, Search, ChevronLeft } from '@lucide/svelte';
	import type { IWikiService } from '../../services/interfaces/IWikiService';
	import type { WikiEntry } from '../../types/wiki';
	import WikiEntryView from '../wiki/WikiEntryView.svelte';

	let { wikiService, activeTab } = $props<{
		wikiService: IWikiService;
		activeTab: string;
	}>();

	let wikis = $state<WikiEntry[]>([]);
	let loading = $state(true);
	let deletingWikis = $state<Set<string>>(new Set());
	let subscriptionCleanup: (() => void) | null = null;
	let searchQuery = $state('');

	// Currently open wiki entry (inline view)
	let openWikiId = $state<string | null>(null);

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
			if (subscriptionCleanup) subscriptionCleanup();
		};
	});

	$effect(() => {
		if (activeTab === 'wiki') {
			loadWikis();
		}
	});

	async function loadWikis() {
		loading = true;
		if ((wikiService as any).subscribeToAllEntries) {
			if (subscriptionCleanup) subscriptionCleanup();
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
		openWikiId = newWiki.id;
	}

	async function handleDeleteWiki(event: MouseEvent, wiki: WikiEntry) {
		event.stopPropagation();
		if (confirm(`Are you sure you want to delete "${wiki.title}"? This action cannot be undone.`)) {
			deletingWikis.add(wiki.id);
			deletingWikis = new Set(deletingWikis);
			try {
				await wikiService.deleteEntry(wiki.id);
				if (openWikiId === wiki.id) openWikiId = null;
				if (!(wikiService as any).subscribeToAll) await loadWikis();
			} finally {
				deletingWikis.delete(wiki.id);
				deletingWikis = new Set(deletingWikis);
			}
		}
	}

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString();
	}

	function getWikiTitle(id: string) {
		return wikis.find((w) => w.id === id)?.title || 'Wiki';
	}
</script>

<div class="flex h-full w-full flex-col overflow-hidden">
	{#if openWikiId}
		<!-- Inline wiki entry view with floating back button -->
		<div class="relative flex h-full flex-col overflow-hidden">
			<!-- Floating back button, top-left -->
			<div class="absolute left-3 top-3 z-10">
				<button
					onclick={() => (openWikiId = null)}
					class="flex items-center gap-1 rounded-md border border-zinc-200 bg-white/80 px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
				>
					<ChevronLeft class="h-3.5 w-3.5" />
					All pages
				</button>
			</div>

			<WikiEntryView
				wikiId={openWikiId}
				onNavigatePage={(pageId) => (openWikiId = pageId)}
			/>
		</div>
	{:else}
		<!-- Wiki list -->
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
							onclick={() => !isDeleting && (openWikiId = wiki.id)}
						>
							<div class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded border border-blue-200 bg-blue-50">
								<FileText class="h-3.5 w-3.5 text-blue-500" />
							</div>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-zinc-800">{wiki.title}</p>
								<p class="text-xs text-zinc-400">Updated {formatDate(wiki.updatedAt)}</p>
							</div>
							<div class="flex flex-shrink-0 items-center gap-1">
								<a
									href="/wiki/{wiki.id}"
									target="_blank"
									onclick={(e) => e.stopPropagation()}
									aria-label="Open in new tab"
									class="rounded p-1 text-zinc-300 transition-colors hover:text-zinc-600"
								>
									<ExternalLink class="h-3.5 w-3.5" />
								</a>
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
	{/if}
</div>
