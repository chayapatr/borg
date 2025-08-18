<script lang="ts">
	import {
		getTemplate,
		getSuggestedFields,
		type NodeTemplate,
		type TemplateField
	} from '../templates';
	import FieldRenderer from './fields/FieldRenderer.svelte';
	import CustomFieldManager from './fields/CustomFieldManager.svelte';
	import FieldVisibilityManager from './fields/FieldVisibilityManager.svelte';
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
	let suggestedFields = $derived(getSuggestedFields(templateType || 'blank'));

	// Reset data when node changes
	$effect(() => {
		if (nodeId && nodeData) {
			editableData = { ...nodeData };
			// Load custom fields from node data
			customFields = nodeData.customFields || [];
		}
	});

	// Autosave when data changes (excluding initial load)
	let hasInitialized = false;
	$effect(() => {
		// Track changes to editableData and customFields by JSON serializing them
		const dataSnapshot = JSON.stringify({ editableData, customFields });
		if (hasInitialized) {
			autoSave();
		} else if (editableData && customFields) {
			hasInitialized = true;
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

	function autoSave() {
		// Debounced autosave to avoid excessive saves
		if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
		isSaving = true;
		autoSaveTimeout = setTimeout(() => {
			handleSave();
			isSaving = false;
		}, 800); // 800ms gives enough time to see the indicator
	}

	let autoSaveTimeout: ReturnType<typeof setTimeout>;
	let isSaving = $state(false);

	function handleDelete() {
		console.log('EditPanel.handleDelete called for:', { nodeId, templateType });

		// Additional safety check for project nodes
		if (templateType === 'project') {
			alert('Project nodes cannot be deleted as they sync with workspace metadata.');
			return;
		}

		if (confirm('Are you sure you want to delete this node?')) {
			console.log('User confirmed deletion, calling onDelete:', nodeId);
			onDelete(nodeId);
			isOpen = false;
		} else {
			console.log('User cancelled deletion');
		}
	}

	function handleClose() {
		// Clear any pending autosave and save immediately before closing
		if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
		handleSave();
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

	function addSuggestedField(suggestedField: TemplateField) {
		// Check if field already exists in custom fields
		const existsInCustom = customFields.some((field) => field.id === suggestedField.id);
		if (existsInCustom) return;

		// Check if field already exists in template fields
		const existsInTemplate = template.fields.some((field) => field.id === suggestedField.id);
		if (existsInTemplate) return;

		// Add the suggested field to custom fields
		customFields = [...customFields, { ...suggestedField, isCustom: true }];
	}

	// Get available suggested fields (not already added)
	let availableSuggestedFields = $derived(
		suggestedFields.filter((suggestedField) => {
			const existsInCustom = customFields.some((field) => field.id === suggestedField.id);
			const existsInTemplate = template.fields.some((field) => field.id === suggestedField.id);
			return !existsInCustom && !existsInTemplate;
		})
	);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<svelte:window on:keydown={handleKeyDown} />

{#if isOpen}
	<!-- Panel -->
	<div
		class="flex h-[calc(100vh-64px)] w-96 flex-col overflow-scroll border-l border-black bg-white shadow-2xl"
	>
		<!-- Header -->
		<div class="border-b border-zinc-800 p-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<!-- <h3 class="font-semibold text-zinc-100">Edit {template.name}</h3> -->
					<span
						class="rounded-md border bg-white px-2 py-1 text-xs font-medium"
						style="border-color: {template.color};"
					>
						{template.name}
					</span>
					{#if isSaving}
						<span class="animate-pulse text-xs font-medium text-zinc-700">💾 Saving...</span>
					{/if}
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
							nodeData={editableData}
						/>
						{#if isProjectMetadata && (field.id === 'title' || field.id === 'status')}
							<p class="mt-1 text-xs text-zinc-500">Changes will sync with project metadata</p>
						{/if}
					</div>
				{/each}

				<!-- Countdown toggle for timeline event nodes -->
				{#if templateType === 'time'}
					<div class="border-t border-zinc-200 pt-4">
						<div class="flex items-center justify-between">
							<div>
								<label class="text-sm font-medium text-zinc-700">Countdown Display Mode</label>
								<p class="text-xs text-zinc-500">Show only event name and countdown timer</p>
							</div>
							<button
								type="button"
								class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none {editableData.countdownMode
									? 'bg-blue-600'
									: 'bg-gray-200'}"
								onclick={() => {
									editableData.countdownMode = !editableData.countdownMode;
								}}
							>
								<span class="sr-only">Toggle countdown mode</span>
								<span
									class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {editableData.countdownMode
										? 'translate-x-5'
										: 'translate-x-0'}"
								></span>
							</button>
						</div>
					</div>
				{/if}

				{#each customFields as field}
					<FieldRenderer
						{field}
						bind:value={editableData[field.id]}
						readonly={false}
						mode="edit"
						nodeData={editableData}
					/>
				{/each}

				<!-- Suggested Fields -->
				{#if availableSuggestedFields.length > 0}
					<div class="border-t border-zinc-200 pt-4">
						<h4 class="mb-2 text-sm font-medium text-zinc-700">Suggested Fields</h4>
						<div class="flex flex-wrap gap-2">
							{#each availableSuggestedFields as suggestedField}
								<button
									type="button"
									onclick={() => addSuggestedField(suggestedField)}
									class="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
								>
									<span>+</span>
									{suggestedField.label}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<CustomFieldManager bind:customFields bind:nodeData={editableData} />

				<FieldVisibilityManager
					templateFields={template.fields}
					bind:customFields
					bind:nodeData={editableData}
				/>
			</div>
		</div>

		<!-- Footer -->
		<div class="flex gap-2 p-4">
			<!-- <button
				onclick={handleSave}
				class="{templateType === 'project'
					? 'w-full'
					: 'flex-1'} rounded-lg bg-borg-violet px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-borg-blue focus:ring-2 focus:ring-borg-blue focus:ring-offset-2 focus:ring-offset-zinc-900 focus:outline-none"
			>
				Save Changes
			</button> -->
			{#if templateType !== 'project'}
				<button
					onclick={handleDelete}
					class="w-full rounded-lg border border-borg-orange px-4 py-2 text-sm font-medium text-borg-orange transition-colors hover:bg-borg-orange hover:text-white focus:ring-2 focus:ring-borg-orange focus:ring-offset-2 focus:ring-offset-zinc-900 focus:outline-none"
				>
					Delete Node
				</button>
			{/if}
		</div>
	</div>
{/if}
