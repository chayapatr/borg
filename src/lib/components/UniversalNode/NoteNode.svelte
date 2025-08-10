<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { Trash2, Pencil } from '@lucide/svelte';

	let { data, id } = $props<{ data: any; id: string }>();

	let nodeData = $derived(data.nodeData || {});

	// Get note dimensions with defaults
	let width = $state(nodeData.width || 128); // Default 128px (w-32)
	let height = $state(nodeData.height || 128); // Default 128px (h-32)

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
		style="background-color: {nodeData.backgroundColor ||
			'#fef08a'}; width: {width}px; height: {height}px;"
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
				class="h-full w-full resize-none border-none bg-transparent p-1 text-sm leading-relaxed break-words text-gray-800 outline-none placeholder:text-gray-500"
				placeholder="Type your note..."
				style="font-family: inherit;"
			></textarea>
		{:else}
			<div
				class="flex h-full w-full items-start overflow-hidden p-1 text-sm leading-relaxed text-balance break-words whitespace-pre-wrap text-gray-800"
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
