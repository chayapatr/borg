<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { Trash2, Pencil } from '@lucide/svelte';

	let { data, id } = $props<{ data: any; id: string }>();

	let nodeData = $derived(data.nodeData || {});

	// Get note size setting with default (current = Small)
	let size = $derived(nodeData.size || 'Small');

	// Combined font and node size classes based on single size property
	let fontSizeClass = $derived.by(() => {
		switch (size) {
			case 'Small':
				return 'text-sm';
			case 'Medium':
				return 'text-lg';
			case 'Large':
				return 'text-2xl';
			default:
				return 'text-sm';
		}
	});

	// Node size classes for post-it notes
	let nodeSizeClass = $derived.by(() => {
		switch (size) {
			case 'Small':
				return 'max-h-32 min-h-24 max-w-32 min-w-24';
			case 'Medium':
				return 'max-h-40 min-h-32 max-w-40 min-w-32';
			case 'Large':
				return 'max-h-48 min-h-40 max-w-48 min-w-40';
			default:
				return 'max-h-32 min-h-24 max-w-32 min-w-24';
		}
	});

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
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div>
	<div
		class="group relative cursor-pointer border border-black aspect-square {nodeSizeClass} rounded-lg p-1 transition-all duration-200"
		style="background-color: {nodeData.backgroundColor || '#fef08a'};"
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
				class="h-full w-full resize-none border-none bg-transparent p-1 {fontSizeClass} leading-relaxed break-words text-gray-800 outline-none placeholder:text-gray-500"
				placeholder="Type your note..."
				style="font-family: inherit;"
			></textarea>
		{:else}
			<div
				class="flex h-full w-full items-center overflow-hidden p-1 break-words {fontSizeClass} leading-relaxed text-balance whitespace-pre-wrap text-gray-800"
			>
				{nodeData.content || 'Click to edit...'}
			</div>
		{/if}

		<!-- Settings and Delete buttons for note nodes -->
		<div
			class="absolute right-1 bottom-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
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