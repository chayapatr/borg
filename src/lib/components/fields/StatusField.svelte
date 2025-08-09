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

	function getStatusColor(status: string): string {
		const statusColors: Record<string, string> = {
			// Universal statuses (To Do/Doing/Done)
			'To Do': 'bg-purple-400 text-black',
			Doing: 'bg-sky-400 text-black',
			Done: 'bg-green-400 text-black',

			// Publication statuses for papers
			Draft: 'bg-gray-300 text-black',
			'In Review': 'bg-yellow-500 text-black',
			Accepted: 'bg-green-500 text-black',
			Published: 'bg-blue-400 text-black'
		};

		return statusColors[status] || 'bg-zinc-500/20 text-zinc-600';
	}
</script>

<div class="field-container">
	<label class="mb-1 block text-sm font-medium text-zinc-600">
		{field.label}
	</label>

	<div class="space-y-2">
		{#if readonly || mode === 'display'}
			{#if value}
				<span
					class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium {getStatusColor(
						value
					)}"
				>
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
						class="inline-flex items-center rounded-full border border-black px-3 py-1 text-xs font-medium transition-colors {value ===
						option
							? getStatusColor(option)
							: 'bg-zinc-100 text-black hover:bg-zinc-300'}"
					>
						{option}
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>