<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { getTemplate, type NodeTemplate } from '../templates';
	import FieldRenderer from './FieldRenderer.svelte';
	import { Trash2, CircleDashed, Hand, CheckCircle } from '@lucide/svelte';

	let { data, id } = $props<{ data: any; id: string }>();

	let template: NodeTemplate = $derived(getTemplate(data.templateType || 'blank'));
	let nodeData = $derived(data.nodeData || {});

	// Determine border color based on status
	let borderColor = $derived.by(() => {
		const status = nodeData.status;
		if (status === 'To Do') return '#8b5cf6'; // purple-500 - planned, future potential
		if (status === 'Doing') return '#3b82f6'; // blue-500 - active, engaged
		if (status === 'Done') return '#22c55e'; // green-500 - success, completion
		return '#3f3f46'; // zinc-700 - default
	});

	// Determine status icon and color
	let statusIcon = $derived.by(() => {
		const status = nodeData.status;
		if (status === 'To Do') return { component: CircleDashed, color: '#8b5cf6' };
		if (status === 'Doing') return { component: Hand, color: '#3b82f6' };
		if (status === 'Done') return { component: CheckCircle, color: '#22c55e' };
		return null; // No icon if status is not set
	});

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

		// Prevent deletion of project nodes (they sync with workspace metadata)
		if (data.templateType === 'project') {
			alert('Project nodes cannot be deleted as they sync with workspace metadata.');
			return;
		}

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
			{#if statusIcon}
				{@const StatusIconComponent = statusIcon.component}
				<StatusIconComponent class="h-5 w-5" style="color: {statusIcon.color};" />
			{/if}
			<span
				class="rounded-md border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-sm font-medium text-white"
				>{template.name}</span
			>
		</div>

		<div class="flex items-center gap-1">
			{#if data.templateType !== 'project'}
				<button
					onclick={handleDelete}
					aria-label="Delete node"
					class="rounded p-1 text-zinc-500 hover:bg-red-500/30 hover:text-zinc-300"
				>
					<Trash2 class="h-4 w-4" />
				</button>
			{/if}
		</div>
	</div>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="min-w-64 cursor-pointer rounded-lg border bg-zinc-900 p-4 shadow-lg transition-colors"
		style="border-color: {borderColor};"
		onclick={handleNodeClick}
	>
		<!-- Node Content -->
		<div class="space-y-3">
			{#each template.fields as field}
				{@const isVisible = nodeData.fieldVisibility?.[field.id] ?? true}
				{#if field.id !== 'status' && isVisible}
					<FieldRenderer {field} value={nodeData[field.id]} readonly={true} mode="display" />
				{/if}
			{/each}

			{#if nodeData.customFields && Array.isArray(nodeData.customFields)}
				{#each nodeData.customFields as field}
					{@const isVisible = field.showInDisplay ?? true}
					{#if isVisible && field.id !== 'status'}
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
