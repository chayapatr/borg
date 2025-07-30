<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { getTemplate, type NodeTemplate } from './templates';
	import FieldRenderer from './FieldRenderer.svelte';

	let { data, id } = $props<{ data: any; id: string }>();

	let template: NodeTemplate = $derived(getTemplate(data.templateType || 'blank'));
	let nodeData = $state(data.nodeData || {});

	// Track changes and auto-save with a timeout to debounce
	let saveTimeout: number | undefined;
	
	$effect(() => {
		// Skip initial effect run
		if (Object.keys(nodeData).length === 0) return;
		
		// Debounce the save operation
		if (saveTimeout) clearTimeout(saveTimeout);
		saveTimeout = setTimeout(() => {
			handleSave();
		}, 500) as any;
	});

	function handleSave() {
		// Update the node data in the store
		data.nodeData = { ...nodeData };

		// Dispatch a custom event to update the data service
		const event = new CustomEvent('nodeUpdate', {
			detail: { nodeId: id, data: { nodeData: { ...nodeData } } }
		});
		document.dispatchEvent(event);
	}

	function handleKeyDown(event: KeyboardEvent) {
		// Auto-save on Cmd+Enter
		if (event.key === 'Enter' && event.metaKey) {
			event.preventDefault();
			event.stopPropagation();
			handleSave();
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

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div tabindex="0" onkeydown={handleKeyDown}>
	<!-- Node Header -->
	<div class="mb-2 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<!-- <div class="h-3 w-3 rounded-full" style="background-color: {template.color};"></div> -->
			<span
				class="rounded-md bg-zinc-900 px-1 py-0.5 text-sm font-medium text-white"
				style="border-color: {template.color}; border-width: 1px;">{template.name}</span
			>
		</div>

		<div class="flex items-center gap-1">
			<button
				onclick={handleDelete}
				aria-label="Delete node"
				class="rounded p-1 text-zinc-500 hover:bg-red-500/30 hover:text-zinc-300"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
					/>
				</svg>
			</button>
		</div>
	</div>
	<div class="min-w-64 rounded-lg border border-zinc-600 bg-zinc-900 p-4 shadow-lg" role="button">
		<!-- Node Content -->
		<div class="space-y-3">
			{#each template.fields as field}
				<FieldRenderer {field} bind:value={nodeData[field.id]} readonly={false} />
			{/each}
		</div>

		<!-- Connection Handles -->
		<Handle type="target" position={Position.Left} class="!bg-zinc-600" />
		<Handle type="source" position={Position.Right} class="!bg-zinc-600" />
	</div>
</div>
