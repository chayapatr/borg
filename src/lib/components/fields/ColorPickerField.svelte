<script lang="ts">
	import type { TemplateField } from '../../templates';

	let {
		field,
		value = $bindable(),
		readonly = false,
		mode = 'display'
	} = $props<{
		field: TemplateField;
		value: any;
		readonly?: boolean;
		mode?: 'display' | 'edit';
	}>();
</script>

<div class="field-container">
	<label class="mb-1 block text-sm font-medium text-zinc-600">
		{field.label}
	</label>

	{#if mode === 'display'}
		{#if value}
			<div class="py-1">
				<div class="flex items-center space-x-2">
					<div
						class="h-4 w-4 rounded border border-gray-300"
						style="background-color: {value}"
					></div>
					<span class="text-sm text-zinc-600">{value}</span>
				</div>
			</div>
		{:else}
			<div class="py-1 text-zinc-600">No color selected</div>
		{/if}
	{:else}
		<div class="space-y-2">
			<input
				type="color"
				bind:value
				class="h-10 w-full cursor-pointer rounded border border-zinc-700"
				{readonly}
			/>
			<div class="grid grid-cols-6 gap-2">
				{#each ['#fef08a', '#fde047', '#facc15', '#fed7d7', '#fbb6ce', '#ddd6fe', '#a5f3fc', '#bbf7d0', '#fed7aa', '#fecaca'] as color}
					<button
						type="button"
						class="h-8 w-8 rounded border-2 border-gray-300 transition-colors hover:border-gray-400"
						style="background-color: {color}"
						onclick={() => {
							value = color;
						}}
					></button>
				{/each}
			</div>
		</div>
	{/if}
</div>