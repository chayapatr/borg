<script lang="ts">
	import type { Sticker } from '../../types/sticker';
	import { ServiceFactory } from '../../services/ServiceFactory';

	let { sticker, category } = $props<{
		sticker: Sticker;
		category: string;
	}>();

	const stickerService = ServiceFactory.createStickerService();

	let imageUrl = $state<string>('');
	let imageLoaded = $state(false);
	let imageError = $state(false);

	// Load the image URL when component mounts
	$effect(async () => {
		try {
			console.log(`🎨 Loading URL for ${category}/${sticker.filename}`);
			imageUrl = await stickerService.getStickerDownloadUrl(category, sticker.filename);
			console.log(`✅ Got URL for ${sticker.filename}:`, imageUrl);
		} catch (error) {
			console.error(`❌ Failed to get sticker URL for ${sticker.filename}:`, error);
			imageError = true;
		}
	});

	function handleImageLoad() {
		imageLoaded = true;
	}

	function handleImageError() {
		imageError = true;
		console.error(`Failed to load sticker image: ${sticker.filename}`);
	}

	// Click handler to add sticker to canvas
	function handleClick() {
		console.log('🎨 Clicked sticker:', sticker.name, 'URL:', imageUrl);
		
		if (!imageUrl) {
			console.warn('⚠️ No image URL available');
			return;
		}
		
		// Dispatch custom event to parent to add sticker to canvas
		const addStickerEvent = new CustomEvent('addSticker', {
			detail: {
				type: 'sticker',
				stickerUrl: imageUrl,
				category: category,
				filename: sticker.filename,
				name: sticker.name
			},
			bubbles: true
		});
		
		document.dispatchEvent(addStickerEvent);
		console.log('🎨 Add sticker event dispatched');
	}
</script>

<div
	class="sticker-item group relative cursor-pointer hover:bg-zinc-700 rounded-lg p-1 transition-colors"
	title={sticker.name}
	onclick={handleClick}
>
	{#if !imageUrl && !imageError}
		<!-- Loading placeholder -->
		<div class="w-16 h-16 bg-zinc-800 rounded-lg flex items-center justify-center">
			<div class="w-4 h-4 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin"></div>
		</div>
	{:else if imageError}
		<!-- Error placeholder -->
		<div class="w-16 h-16 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center justify-center">
			<span class="text-xs text-red-400">✗</span>
		</div>
	{:else}
		<!-- Sticker image -->
		<img
			src={imageUrl}
			alt={sticker.name}
			class="w-16 h-16 object-contain rounded-lg transition-all duration-200 group-hover:scale-110 group-hover:shadow-lg {imageLoaded ? 'opacity-100' : 'opacity-0'}"
			onload={handleImageLoad}
			onerror={handleImageError}
			draggable="false"
		/>
		
		<!-- Hover overlay with name -->
		<div class="absolute inset-0 bg-black/70 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
			<span class="text-xs text-white font-medium text-center px-1 leading-tight">{sticker.name}</span>
		</div>
	{/if}
</div>

<style>
	.sticker-item {
		touch-action: none;
	}
</style>