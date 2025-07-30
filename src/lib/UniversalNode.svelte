<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { getTemplate, type NodeTemplate } from './templates';
	import FieldRenderer from './FieldRenderer.svelte';

	let { data, id } = $props<{ data: any; id: string }>();
	
	let template: NodeTemplate = $derived(getTemplate(data.templateType || 'blank'));
	let isEditing = $state(false);
	let nodeData = $state(data.nodeData || {});

	function handleEdit() {
		isEditing = true;
	}

	function handleSave() {
		// Update the node data in the store
		data.nodeData = { ...nodeData };
		isEditing = false;
		
		// Dispatch a custom event to update the data service
		const event = new CustomEvent('nodeUpdate', { 
			detail: { nodeId: id, data: { nodeData: { ...nodeData } } }
		});
		document.dispatchEvent(event);
	}

	function handleCancel() {
		// Reset to original data
		nodeData = { ...data.nodeData };
		isEditing = false;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && event.metaKey) {
			handleSave();
		} else if (event.key === 'Escape') {
			handleCancel();
		} else if (event.key === 'Delete' || event.key === 'Backspace') {
			handleDelete();
		}
	}

	function handleDelete() {
		if (confirm('Are you sure you want to delete this node?')) {
			// Dispatch a custom event to parent
			const event = new CustomEvent('nodeDelete', { detail: { nodeId: id } });
			document.dispatchEvent(event);
		}
	}
</script>

<svelte:window on:keydown={handleKeyDown} />

<div
	class="min-w-64 rounded-lg border bg-zinc-900 p-4 shadow-lg"
	style="border-color: {template.color}; border-width: 2px;"
>
	<!-- Node Header -->
	<div class="mb-3 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<div
				class="h-3 w-3 rounded-full"
				style="background-color: {template.color};"
			></div>
			<span class="text-sm font-medium text-zinc-400">{template.name}</span>
		</div>
		
		{#if !isEditing}
			<button
				onclick={handleEdit}
				aria-label="Edit node"
				class="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
				</svg>
			</button>
		{/if}
	</div>

	<!-- Node Content -->
	<div class="space-y-3">
		{#each template.fields as field}
			<FieldRenderer
				{field}
				bind:value={nodeData[field.id]}
				readonly={!isEditing}
			/>
		{/each}
	</div>

	<!-- Edit Controls -->
	{#if isEditing}
		<div class="mt-4 flex justify-end gap-2 border-t border-zinc-700 pt-3">
			<button
				onclick={handleCancel}
				class="rounded bg-zinc-700 px-3 py-1 text-sm text-zinc-300 hover:bg-zinc-600"
			>
				Cancel
			</button>
			<button
				onclick={handleSave}
				class="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-500"
			>
				Save
			</button>
		</div>
	{/if}

	<!-- Connection Handles -->
	<Handle type="target" position={Position.Left} class="!bg-zinc-600" />
	<Handle type="source" position={Position.Right} class="!bg-zinc-600" />
</div>