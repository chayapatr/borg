<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { Trash2, RotateCw, Pencil } from '@lucide/svelte';

	let { data, id } = $props<{ data: any; id: string }>();

	let nodeData = $derived(data.nodeData || {});

	// Get sticker dimensions with defaults
	let width = $state(nodeData.width || 100);
	let height = $state(nodeData.height || 100);
	let rotation = $state(nodeData.rotation || 0);

	// Update dimensions when nodeData changes
	$effect(() => {
		width = nodeData.width || 100;
		height = nodeData.height || 100;
		rotation = nodeData.rotation || 0;
	});

	// Sticker data - use derived to react to nodeData changes
	let stickerUrl = $derived(nodeData.stickerUrl || '');
	let category = $derived(nodeData.category || '');
	let filename = $derived(nodeData.filename || '');

	// Debug logging
	$effect(() => {
		console.log('🎨 StickerNode data:', { stickerUrl, category, filename, nodeData });
	});

	// Resize state
	let isResizing = $state(false);
	let resizeHandle = $state<string | null>(null);

	// Handle resize start
	function startResize(event: MouseEvent, handle: string) {
		event.preventDefault();
		event.stopPropagation();
		
		isResizing = true;
		resizeHandle = handle;
		
		const startX = event.clientX;
		const startY = event.clientY;
		const startWidth = width;
		const startHeight = height;
		const aspectRatio = startWidth / startHeight;

		function handleMouseMove(e: MouseEvent) {
			const deltaX = e.clientX - startX;
			const deltaY = e.clientY - startY;

			if (handle === 'se') {
				// Southeast handle - maintain aspect ratio
				const newWidth = Math.max(50, startWidth + deltaX);
				const newHeight = newWidth / aspectRatio;
				width = newWidth;
				height = newHeight;
			}
		}

		function handleMouseUp() {
			isResizing = false;
			resizeHandle = null;
			updateNodeData();
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
		}

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	}

	// Update node data
	function updateNodeData() {
		// Update the data prop immediately - preserve all sticker data
		data.nodeData = {
			...nodeData,
			width,
			height,
			rotation,
			stickerUrl: nodeData.stickerUrl || stickerUrl,
			category: nodeData.category || category,
			filename: nodeData.filename || filename
		};

		// Dispatch update event to save - preserve all sticker data
		const event = new CustomEvent('nodeUpdate', {
			detail: {
				nodeId: id,
				data: {
					nodeData: {
						...nodeData,
						width,
						height,
						rotation,
						stickerUrl: nodeData.stickerUrl || stickerUrl,
						category: nodeData.category || category,
						filename: nodeData.filename || filename
					}
				}
			}
		});
		document.dispatchEvent(event);
	}

	// Handle rotation
	function handleRotate(event: MouseEvent) {
		event.stopPropagation();
		rotation = (rotation + 90) % 360;
		updateNodeData();
	}

	// Handle settings click
	function handleSettingsClick(event: MouseEvent) {
		event.stopPropagation();

		// Dispatch edit event for settings panel
		const editEvent = new CustomEvent('nodeEdit', {
			detail: {
				nodeId: id,
				nodeData: nodeData,
				templateType: data.templateType
			}
		});
		document.dispatchEvent(editEvent);
	}

	// Handle delete
	function handleDelete(event: MouseEvent) {
		event.stopPropagation();

		if (confirm('Are you sure you want to delete this sticker?')) {
			const deleteEvent = new CustomEvent('nodeDelete', { 
				detail: { nodeId: id } 
			});
			document.dispatchEvent(deleteEvent);
		}
	}

	// Handle context menu (right-click)
	function handleContextMenu(event: MouseEvent) {
		event.preventDefault();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div>
	<div 
		class="sticker-node group relative cursor-grab active:cursor-grabbing"
		style="width: {width}px; height: {height}px;"
		oncontextmenu={handleContextMenu}
	>
		<!-- Main sticker image -->
		{#if stickerUrl}
			<img 
				src={stickerUrl}
				alt="{category} sticker"
				class="w-full h-full object-contain rounded-lg shadow-lg transition-all duration-200 group-hover:shadow-xl"
				style="transform: rotate({rotation}deg);"
				draggable="false"
			/>
		{:else}
			<div class="w-full h-full bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-500 text-sm">
				No Image
			</div>
		{/if}

		<!-- Resize handle (bottom-right corner) -->
		<div
			class="nodrag absolute right-0 bottom-0 z-10 h-4 w-4 cursor-se-resize bg-transparent opacity-0 transition-opacity group-hover:opacity-100"
			onmousedown={(e) => startResize(e, 'se')}
			aria-label="Resize sticker"
			role="button"
			tabindex="-1"
		>
			<!-- Resize grip lines -->
			<div class="pointer-events-none absolute right-1 bottom-1 h-2 w-2">
				<div class="absolute right-0 bottom-0 h-0.5 w-2 bg-gray-700"></div>
				<div class="absolute right-0 bottom-1 h-0.5 w-1.5 bg-gray-700"></div>
				<div class="absolute right-0 bottom-2 h-0.5 w-1 bg-gray-700"></div>
			</div>
		</div>

		<!-- Toolbar (visible on hover) -->
		<div
			class="absolute -top-8 left-0 flex items-center gap-1 bg-zinc-800 border border-zinc-600 rounded-lg px-2 py-1 shadow-lg opacity-0 transition-opacity group-hover:opacity-100"
		>
			<button
				onclick={handleRotate}
				class="p-1 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"
				title="Rotate 90°"
				aria-label="Rotate sticker"
			>
				<RotateCw class="w-3 h-3" />
			</button>
			<button
				onclick={handleSettingsClick}
				class="p-1 text-zinc-400 hover:text-blue-400 hover:bg-zinc-700 rounded transition-colors"
				title="Edit settings"
				aria-label="Edit sticker settings"
			>
				<Pencil class="w-3 h-3" />
			</button>
			<button
				onclick={handleDelete}
				class="p-1 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 rounded transition-colors"
				title="Delete sticker"
				aria-label="Delete sticker"
			>
				<Trash2 class="w-3 h-3" />
			</button>
		</div>

		<!-- Connection handles (hidden by default for stickers) -->
		<Handle type="target" position={Position.Left} class="!opacity-0 !pointer-events-none" />
		<Handle type="source" position={Position.Right} class="!opacity-0 !pointer-events-none" />
	</div>
</div>

<style>
	.sticker-node {
		user-select: none;
	}
</style>