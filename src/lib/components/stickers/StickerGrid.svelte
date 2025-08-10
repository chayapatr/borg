<script lang="ts">
	import type { StickerCategory } from '../../types/sticker';
	import StickerItem from './StickerItem.svelte';

	let { category } = $props<{
		category: StickerCategory;
	}>();
</script>

<div class="sticker-grid-container h-full flex flex-col">
	<!-- Stickers grid with scroll -->
	<div class="flex-1 overflow-y-auto p-4">
		<div class="grid grid-cols-4 gap-3">
			{#each category.stickers as sticker}
				<StickerItem {sticker} category={category.name} />
			{/each}
		</div>

		<!-- Empty state -->
		{#if category.stickers.length === 0}
			<div class="flex items-center justify-center h-32 text-zinc-500">
				<span>No stickers in this category</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.sticker-grid-container {
		min-height: 0; /* Allow flex child to shrink */
	}
</style>