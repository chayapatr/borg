<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { getTemplate, type NodeTemplate } from './templates';
	import FieldRenderer from './FieldRenderer.svelte';

	let { data, id } = $props<{ data: any; id: string }>();

	let template: NodeTemplate = $derived(getTemplate(data.templateType || 'blank'));
	let nodeData = $derived(data.nodeData || {});

	function handleNodeClick() {
		// Dispatch a custom event to open the edit panel
		const event = new CustomEvent('nodeEdit', {
			detail: { 
				nodeId: id, 
				nodeData: nodeData,
				templateType: data.templateType
			}
		});
		document.dispatchEvent(event);
	}

	function handleDelete(event: MouseEvent) {
		event.stopPropagation(); // Prevent triggering the node click
		if (confirm('Are you sure you want to delete this node?')) {
			// Dispatch a custom event to parent
			const event = new CustomEvent('nodeDelete', { detail: { nodeId: id } });
			document.dispatchEvent(event);
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div>
	<!-- Node Header -->
	<div class="mb-2 flex items-center justify-between">
		<div class="flex items-center gap-2">
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
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div 
		class="min-w-64 rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-lg cursor-pointer hover:border-zinc-600 transition-colors" 
		onclick={handleNodeClick}
	>
		<!-- Node Content -->
		<div class="space-y-3">
			{#each template.fields as field}
				{@const isVisible = nodeData.fieldVisibility?.[field.id] ?? true}
				{#if isVisible}
					<FieldRenderer {field} value={nodeData[field.id]} readonly={true} mode="display" />
				{/if}
			{/each}
			
			{#if nodeData.customFields && Array.isArray(nodeData.customFields)}
				{#each nodeData.customFields as field}
					{@const isVisible = field.showInDisplay ?? true}
					{#if isVisible}
						<FieldRenderer {field} value={nodeData[field.id]} readonly={true} mode="display" />
					{/if}
				{/each}
			{/if}
		</div>

		<!-- Connection Handles -->
		<Handle type="target" position={Position.Left} class="!bg-zinc-600" />
		<Handle type="source" position={Position.Right} class="!bg-zinc-600" />
	</div>
</div>
