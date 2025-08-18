<script lang="ts">
	import type { TemplateField } from '../../templates';

	let {
		field,
		value = $bindable(),
		readonly = false,
		mode = 'display'
	} = $props<{
		field: TemplateField;
		value: string;
		readonly?: boolean;
		mode?: 'display' | 'edit';
	}>();

	// Initialize with default value if available
	$effect(() => {
		if (!value && field.defaultValue) {
			value = field.defaultValue;
		}
	});
</script>

<div class="field-container">
	{#if mode === 'edit'}
		<label class="mb-1 block text-sm font-medium text-zinc-600" for={field.id}>
			{field.label}
		</label>
		<input
			id={field.id}
			type="time"
			bind:value
			placeholder={field.placeholder}
			disabled={readonly}
			class="w-full rounded border border-black px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-100"
		/>
	{:else if value}
		<div class="flex items-center gap-2">
			<span class="text-sm font-medium text-zinc-600">{field.label}:</span>
			<span class="text-sm text-zinc-900">{value}</span>
		</div>
	{/if}
</div>

<style>
	.field-container {
		width: 100%;
	}
</style>