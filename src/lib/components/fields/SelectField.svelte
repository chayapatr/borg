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

	<div class="space-y-2">
		{#if readonly || mode === 'display'}
			{#if value}
				<span class="inline-flex items-center rounded-full bg-black px-3 py-1 text-xs font-medium text-white">
					{value}
				</span>
			{:else}
				<div class="py-1 text-black">-</div>
			{/if}
		{:else}
			<div class="flex flex-wrap gap-2">
				{#each field.options || [] as option}
					<button
						type="button"
						onclick={() => (value = value === option ? '' : option)}
						class="inline-flex items-center rounded-full border border-black px-3 py-1 text-xs font-medium transition-colors {value === option
							? 'bg-black text-white'
							: 'bg-white text-black hover:bg-gray-100'}"
					>
						{option}
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>