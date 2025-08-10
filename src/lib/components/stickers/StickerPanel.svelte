<script lang="ts">
	import { X, Search } from '@lucide/svelte';
	import { ServiceFactory } from '../../services/ServiceFactory';
	import type { StickerCategory } from '../../types/sticker';
	import StickerGrid from './StickerGrid.svelte';

	let { isOpen = $bindable(), onClose } = $props<{
		isOpen: boolean;
		onClose: () => void;
	}>();

	const stickerService = ServiceFactory.createStickerService();

	let categories = $state<StickerCategory[]>([]);
	let activeCategory = $state<string>('');
	let searchTerm = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);

	// Load categories when panel opens
	$effect(() => {
		if (isOpen && categories.length === 0) {
			(async () => {
				try {
					console.log('🎨 Loading sticker categories...');
					loading = true;
					error = null;
					categories = await stickerService.getCategories();
					console.log('🎨 Loaded categories:', categories.length);
					
					if (categories.length > 0 && !activeCategory) {
						activeCategory = categories[0].slug;
						console.log('🎨 Set active category:', activeCategory);
					}
				} catch (err) {
					console.error('❌ Failed to load sticker categories:', err);
					error = 'Failed to load stickers. Please try again.';
				} finally {
					loading = false;
					console.log('🎨 Loading complete. Categories:', categories.length, 'Active:', activeCategory);
				}
			})();
		}
	});

	// Get active category data
	let activeCategoryData = $derived(
		categories.find(cat => cat.slug === activeCategory)
	);

	// Filter categories based on search
	let filteredCategories = $derived(
		categories.filter(cat => 
			cat.name.toLowerCase().includes(searchTerm.toLowerCase())
		)
	);

	function handleCategoryClick(categorySlug: string) {
		activeCategory = categorySlug;
		searchTerm = ''; // Clear search when switching categories
	}

	function handleClose() {
		onClose();
	}

	// Handle escape key to close
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			handleClose();
		}
	}
</script>

{#if isOpen}
	<div class="flex h-full w-80 flex-col border-l border-black bg-white"
		role="dialog"
		aria-modal="true"
		aria-labelledby="sticker-panel-title"
		tabindex="-1"
		onkeydown={handleKeyDown}
	>
		<!-- Header -->
		<div class="border-b border-black p-4">
			<div class="flex items-center justify-between">
				<div>
					<h3 class="font-semibold text-black">Stickers</h3>
					<p class="text-sm text-zinc-500">Add stickers to your canvas</p>
				</div>
				<button
					onclick={handleClose}
					class="rounded-lg p-1 text-zinc-400 hover:bg-black hover:text-white"
					aria-label="Close sticker panel"
				>
					<X class="h-5 w-5" />
				</button>
			</div>
		</div>

		<!-- Search -->
		<div class="p-4 border-b border-black">
			<div class="relative">
				<Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
				<input
					type="text"
					placeholder="Search categories..."
					bind:value={searchTerm}
					class="w-full pl-10 pr-4 py-2 bg-white border border-black rounded-lg text-black placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
				/>
			</div>
		</div>


		<!-- Loading state -->
		{#if loading}
			<div class="flex-1 flex items-center justify-center">
				<div class="flex items-center gap-3 text-zinc-500">
					<div class="w-6 h-6 border-2 border-zinc-300 border-t-black rounded-full animate-spin"></div>
					<span>Loading stickers...</span>
				</div>
			</div>
		{:else if error}
			<!-- Error state -->
			<div class="flex-1 flex items-center justify-center p-4">
				<div class="text-center text-red-600">
					<p class="mb-2">⚠️</p>
					<p class="text-sm">{error}</p>
					<button
						onclick={() => stickerService.refreshCatalog()}
						class="mt-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 hover:bg-red-100 transition-colors text-sm"
					>
						Retry
					</button>
				</div>
			</div>
		{:else}
			<!-- Category tabs and content -->
			<div class="flex-1 flex flex-col min-h-0">
				<!-- Category tabs -->
				<div class="flex overflow-x-auto border-b border-black">
					{#each filteredCategories as category}
						<button
							onclick={() => handleCategoryClick(category.slug)}
							class="flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors border-b-2 {activeCategory === category.slug 
								? 'border-black text-black bg-borg-beige' 
								: 'border-transparent text-zinc-500 hover:text-black hover:bg-zinc-100'}"
						>
							{category.name}
							<span class="ml-2 text-xs opacity-60">({category.count})</span>
						</button>
					{/each}
				</div>

				<!-- Active category content -->
				{#if activeCategoryData}
					<StickerGrid category={activeCategoryData} />
				{:else}
					<div class="flex-1 flex items-center justify-center text-zinc-500">
						<span>No category selected</span>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}