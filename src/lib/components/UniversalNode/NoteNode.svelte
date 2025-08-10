<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { Trash2, Pencil, Bold } from '@lucide/svelte';

	let { data, id } = $props<{ data: any; id: string }>();

	let nodeData = $derived(data.nodeData || {});

	// Get note dimensions with defaults
	let width = $state(nodeData.width || 128); // Default 128px (w-32)
	let height = $state(nodeData.height || 128); // Default 128px (h-32)

	// Update dimensions when nodeData changes
	$effect(() => {
		width = nodeData.width || 128;
		height = nodeData.height || 128;
	});

	// Get font weight with default (normal)
	let fontWeight = $state(nodeData.fontWeight || 'normal');

	// Update font weight when nodeData changes
	$effect(() => {
		fontWeight = nodeData.fontWeight || 'normal';
	});

	// Get text size with default (Small)
	let textSizeClass = $derived.by(() => {
		const textSize = nodeData.textSize || 'Small';
		switch (textSize) {
			case 'Small':
				return 'text-sm';
			case 'Medium':
				return 'text-lg';
			case 'Large':
				return 'text-xl';
			case 'Extra Large':
				return 'text-3xl';
			default:
				return 'text-sm';
		}
	});

	// Get font weight class
	let fontWeightClass = $derived(fontWeight === 'bold' ? 'font-semibold' : 'font-normal');

	// Get background style based on selection
	let backgroundStyle = $derived.by(() => {
		const bgValue = nodeData.backgroundColor || '#fef08a';
		
		if (bgValue.startsWith('linear-gradient')) {
			return `background: ${bgValue}`;
		} else {
			return `background-color: ${bgValue}`;
		}
	});

	// Resize state
	let isResizing = $state(false);
	let resizeStartX = $state(0);
	let resizeStartY = $state(0);
	let startWidth = $state(0);
	let startHeight = $state(0);

	// Post-it inline editing state
	let isEditingNote = $state(false);
	let noteContent = $state('');
	let textarea = $state<HTMLTextAreaElement>();

	function handleNodeClick() {
		startInlineEdit();
	}

	function startInlineEdit() {
		isEditingNote = true;
		noteContent = nodeData.content || '';

		// Focus the textarea after it's rendered
		setTimeout(() => {
			if (textarea) {
				textarea.focus();
				textarea.select();
			}
		}, 0);
	}

	function handleNoteInput() {
		// No auto-save interval - only save on unfocus
	}

	function saveNoteContent() {
		// Update the data prop immediately to reflect changes
		data.nodeData = {
			...nodeData,
			content: noteContent
		};

		// Dispatch update event to save the content to service
		const event = new CustomEvent('nodeUpdate', {
			detail: {
				nodeId: id,
				data: {
					nodeData: {
						...nodeData,
						content: noteContent
					}
				}
			}
		});
		document.dispatchEvent(event);
	}

	function handleNoteBlur() {
		// Save immediately when losing focus
		saveNoteContent();
		isEditingNote = false;
	}

	function handleNoteKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			// Save and exit on Enter (Shift+Enter for new line)
			event.preventDefault();
			handleNoteBlur();
		} else if (event.key === 'Escape') {
			// Cancel editing on Escape
			event.preventDefault();
			noteContent = nodeData.content || '';
			isEditingNote = false;
		}
	}

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

	function handleDelete(event: MouseEvent) {
		event.stopPropagation(); // Prevent triggering the node click

		if (confirm('Are you sure you want to delete this note?')) {
			// Dispatch a custom event to parent
			const deleteEvent = new CustomEvent('nodeDelete', { detail: { nodeId: id } });
			document.dispatchEvent(deleteEvent);
		}
	}

	function toggleFontWeight(event: MouseEvent) {
		event.stopPropagation();
		
		const newFontWeight = fontWeight === 'bold' ? 'normal' : 'bold';
		fontWeight = newFontWeight;

		// Update the data prop immediately
		data.nodeData = {
			...nodeData,
			fontWeight: newFontWeight
		};

		// Dispatch update event to save the font weight
		const updateEvent = new CustomEvent('nodeUpdate', {
			detail: {
				nodeId: id,
				data: {
					nodeData: {
						...nodeData,
						fontWeight: newFontWeight
					}
				}
			}
		});
		document.dispatchEvent(updateEvent);
	}

	function startResize(event: MouseEvent) {
		event.stopPropagation();
		event.preventDefault();

		isResizing = true;
		resizeStartX = event.clientX;
		resizeStartY = event.clientY;
		startWidth = width;
		startHeight = height;

		document.addEventListener('mousemove', handleResize);
		document.addEventListener('mouseup', stopResize);
		document.body.style.cursor = 'se-resize';
	}

	function handleResize(event: MouseEvent) {
		if (!isResizing) return;

		const deltaX = event.clientX - resizeStartX;
		const deltaY = event.clientY - resizeStartY;

		width = Math.max(80, startWidth + deltaX); // Min width 80px
		height = Math.max(60, startHeight + deltaY); // Min height 60px
	}

	function stopResize() {
		if (!isResizing) return;

		isResizing = false;
		document.removeEventListener('mousemove', handleResize);
		document.removeEventListener('mouseup', stopResize);
		document.body.style.cursor = '';

		// Save the new dimensions
		data.nodeData = {
			...nodeData,
			width,
			height
		};

		// Dispatch update event to save dimensions
		const event = new CustomEvent('nodeUpdate', {
			detail: {
				nodeId: id,
				data: {
					nodeData: {
						...nodeData,
						width,
						height
					}
				}
			}
		});
		document.dispatchEvent(event);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div>
	<div
		class="group relative cursor-pointer rounded-lg border border-black p-1 transition-all duration-200"
		style="{backgroundStyle}; width: {width}px; height: {height}px;"
		onclick={handleNodeClick}
	>
		<!-- Post-it note content -->
		{#if isEditingNote}
			<textarea
				bind:this={textarea}
				bind:value={noteContent}
				oninput={handleNoteInput}
				onblur={handleNoteBlur}
				onkeydown={handleNoteKeydown}
				class="h-full w-full resize-none border-none bg-transparent p-1 {textSizeClass} {fontWeightClass} leading-relaxed break-words text-gray-800 outline-none placeholder:text-gray-500"
				placeholder="Type your note..."
				style="font-family: inherit;"
			></textarea>
		{:else}
			<div
				class="flex h-full w-full items-start overflow-hidden p-1 {textSizeClass} {fontWeightClass} leading-relaxed text-balance break-words whitespace-pre-wrap text-gray-800"
			>
				{nodeData.content || 'Click to edit...'}
			</div>
		{/if}

		<!-- Resize handle -->
		<div
			class="nodrag absolute right-0 bottom-0 z-10 h-4 w-4 cursor-se-resize bg-transparent opacity-0 transition-opacity group-hover:opacity-100"
			onmousedown={startResize}
			aria-label="Resize note"
			role="button"
			tabindex="-1"
		>
			<!-- Resize grip lines -->
			<div class="pointer-events-none absolute right-1 bottom-1 h-2 w-2">
				<div class="absolute right-0 bottom-0 h-0.5 w-2 bg-gray-500"></div>
				<div class="absolute right-0 bottom-1 h-0.5 w-1.5 bg-gray-500"></div>
				<div class="absolute right-0 bottom-2 h-0.5 w-1 bg-gray-500"></div>
			</div>
		</div>

		<!-- Settings and Delete buttons for note nodes -->
		<div
			class="absolute top-1 right-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
		>
			<button
				onclick={toggleFontWeight}
				aria-label="Toggle font weight"
				class="rounded p-1 text-gray-600 hover:bg-white/50 hover:text-gray-800 {fontWeight === 'bold' ? 'bg-white/50 text-gray-800' : ''}"
			>
				<Bold class="h-3 w-3" />
			</button>
			<button
				onclick={handleSettingsClick}
				aria-label="Edit settings"
				class="rounded p-1 text-gray-600 hover:bg-white/50 hover:text-blue-600"
			>
				<Pencil class="h-3 w-3" />
			</button>
			<button
				onclick={(event) => {
					event.stopPropagation();
					handleDelete(event);
				}}
				aria-label="Delete note"
				class="rounded p-1 text-gray-600 hover:bg-white/50 hover:text-red-600"
			>
				<Trash2 class="h-3 w-3" />
			</button>
		</div>

		<!-- Connection Handles -->
		<Handle type="target" position={Position.Left} class="!bg-zinc-600" />
		<Handle type="source" position={Position.Right} class="!bg-zinc-600" />
	</div>
</div>
