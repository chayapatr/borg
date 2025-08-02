<script lang="ts">
	import { Eye, EyeOff } from '@lucide/svelte';
	import type { TemplateField } from './templates';

	let {
		templateFields,
		customFields = $bindable(),
		nodeData = $bindable()
	} = $props<{
		templateFields: TemplateField[];
		customFields: TemplateField[];
		nodeData: Record<string, any>;
	}>();

	function toggleFieldVisibility(fieldId: string, isCustom: boolean = false) {
		if (isCustom) {
			// Update custom field visibility
			const fieldIndex = customFields.findIndex(f => f.id === fieldId);
			if (fieldIndex !== -1) {
				customFields[fieldIndex].showInDisplay = !customFields[fieldIndex].showInDisplay;
				customFields = [...customFields]; // Trigger reactivity
			}
		} else {
			// For template fields, store visibility in nodeData
			if (!nodeData.fieldVisibility) {
				nodeData.fieldVisibility = {};
			}
			const currentVisibility = nodeData.fieldVisibility[fieldId] ?? true;
			nodeData.fieldVisibility[fieldId] = !currentVisibility;
			nodeData = { ...nodeData }; // Trigger reactivity
		}
	}

	function getFieldVisibility(field: TemplateField, isCustom: boolean = false): boolean {
		if (isCustom) {
			return field.showInDisplay ?? true;
		} else {
			return nodeData.fieldVisibility?.[field.id] ?? true;
		}
	}

	let allFields = $derived([
		...templateFields.filter(f => f.id !== 'status').map(f => ({ ...f, isCustom: false })),
		...customFields.filter(f => f.id !== 'status').map(f => ({ ...f, isCustom: true }))
	]);
</script>

<div class="border-t border-zinc-700 pt-4 mt-4">
	<div class="flex items-center justify-between mb-3">
		<h4 class="text-sm font-medium text-zinc-300">Field Visibility</h4>
		<span class="text-xs text-zinc-500">Control which fields show in display mode</span>
	</div>

	{#if allFields.length > 0}
		<div class="space-y-2">
			{#each allFields as field}
				{@const isVisible = getFieldVisibility(field, field.isCustom)}
				<div class="flex items-center justify-between bg-zinc-800 rounded px-3 py-2">
					<div class="flex items-center gap-2">
						<span class="text-sm text-zinc-300">{field.label}</span>
						{#if field.isCustom}
							<span class="text-xs text-zinc-500 bg-zinc-700 px-1 rounded">custom</span>
						{/if}
					</div>
					<button
						onclick={() => toggleFieldVisibility(field.id, field.isCustom)}
						class="flex items-center gap-1 text-xs transition-colors {isVisible 
							? 'text-green-400 hover:text-green-300' 
							: 'text-zinc-500 hover:text-zinc-400'}"
						aria-label={isVisible ? 'Hide field' : 'Show field'}
					>
						{#if isVisible}
							<Eye class="w-3 h-3" />
							<span>Visible</span>
						{:else}
							<EyeOff class="w-3 h-3" />
							<span>Hidden</span>
						{/if}
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>