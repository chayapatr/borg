<script lang="ts">
	import { getTemplate, type NodeTemplate, type TemplateField } from '../templates';
	import FieldRenderer from './FieldRenderer.svelte';
	import CustomFieldManager from './CustomFieldManager.svelte';
	import FieldVisibilityManager from './FieldVisibilityManager.svelte';
	import { X } from '@lucide/svelte';

	let {
		nodeId,
		nodeData,
		templateType,
		isOpen = $bindable(),
		onSave,
		onDelete
	} = $props<{
		nodeId: string;
		nodeData: any;
		templateType: string;
		isOpen: boolean;
		onSave: (nodeId: string, data: any) => void;
		onDelete: (nodeId: string) => void;
	}>();

	let template: NodeTemplate = $derived(getTemplate(templateType || 'blank'));
	let editableData = $state({ ...nodeData });
	let customFields = $state<TemplateField[]>([]);
	let isProjectMetadata = $derived(templateType === 'project');

	// Reset data when node changes
	$effect(() => {
		if (nodeId && nodeData) {
			editableData = { ...nodeData };
			// Load custom fields from node data
			customFields = nodeData.customFields || [];
		}
	});

	function handleSave() {
		// Include custom fields in the saved data
		const dataToSave = {
			...editableData,
			customFields: customFields
		};
		onSave(nodeId, { nodeData: dataToSave });
	}

	function handleDelete() {
		// Additional safety check for project nodes
		if (templateType === 'project') {
			alert('Project nodes cannot be deleted as they sync with workspace metadata.');
			return;
		}

		if (confirm('Are you sure you want to delete this node?')) {
			onDelete(nodeId);
			isOpen = false;
		}
	}

	function handleClose() {
		isOpen = false;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			handleClose();
		} else if (event.key === 'Enter' && event.metaKey) {
			event.preventDefault();
			handleSave();
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<svelte:window on:keydown={handleKeyDown} />

{#if isOpen}
	<!-- Panel -->
	<div class="flex w-96 flex-col border-l border-zinc-800 bg-zinc-900 shadow-2xl">
		<!-- Header -->
		<div class="border-b border-zinc-800 p-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<!-- <h3 class="font-semibold text-zinc-100">Edit {template.name}</h3> -->
					<span
						class="rounded-md border bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-400"
						style="border-color: {template.color};"
					>
						{template.name}
					</span>
				</div>
				<button
					onclick={handleClose}
					aria-label="Close panel"
					class="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
				>
					<X class="h-5 w-5" />
				</button>
			</div>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-4">
			<div class="space-y-4">
				{#each template.fields as field}
					<div>
						<FieldRenderer
							{field}
							bind:value={editableData[field.id]}
							readonly={false}
							mode="edit"
						/>
						{#if isProjectMetadata && (field.id === 'title' || field.id === 'status')}
							<p class="mt-1 text-xs text-zinc-500">Changes will sync with project metadata</p>
						{/if}
					</div>
				{/each}

				{#each customFields as field}
					<FieldRenderer {field} bind:value={editableData[field.id]} readonly={false} mode="edit" />
				{/each}

				<CustomFieldManager bind:customFields bind:nodeData={editableData} />

				<FieldVisibilityManager
					templateFields={template.fields}
					bind:customFields
					bind:nodeData={editableData}
				/>
			</div>
		</div>

		<!-- Footer -->
		<div class="flex gap-2 border-t border-zinc-800 p-4">
			<button
				onclick={handleSave}
				class="{templateType === 'project'
					? 'w-full'
					: 'flex-1'} rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:outline-none"
			>
				Save Changes
			</button>
			{#if templateType !== 'project'}
				<button
					onclick={handleDelete}
					class="rounded-lg border border-red-600 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-600/10 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:outline-none"
				>
					Delete
				</button>
			{/if}
		</div>
	</div>
{/if}
