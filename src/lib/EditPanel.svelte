<script lang="ts">
	import { getTemplate, type NodeTemplate, type TemplateField } from './templates';
	import FieldRenderer from './FieldRenderer.svelte';
	import CustomFieldManager from './CustomFieldManager.svelte';
	import FieldVisibilityManager from './FieldVisibilityManager.svelte';

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
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" onclick={handleClose}></div>

	<!-- Panel -->
	<div
		class="fixed top-2 right-2 bottom-2 z-50 flex w-96 flex-col rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl"
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-zinc-700 p-4">
			<div class="flex items-center gap-2">
				<span
					class="rounded-md border bg-zinc-800 px-2 py-1 text-sm font-medium text-white"
					style="border-color: {template.color};"
				>
					{template.name}
				</span>
			</div>
			<button
				onclick={handleClose}
				aria-label="Close panel"
				class="rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-4">
			<div class="space-y-4">
				{#each template.fields as field}
					<div>
						<FieldRenderer {field} bind:value={editableData[field.id]} readonly={false} mode="edit" />
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
		<div class="flex gap-2 border-t border-zinc-700 p-4">
			<button
				onclick={handleSave}
				class="{templateType === 'project' ? 'w-full' : 'flex-1'} rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:outline-none"
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
