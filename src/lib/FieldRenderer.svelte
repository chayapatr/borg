<script lang="ts">
	import type { TemplateField } from './templates';

	let { field, value = $bindable(''), readonly = false } = $props<{
		field: TemplateField;
		value: any;
		readonly?: boolean;
	}>();

	function handleTagsInput(event: KeyboardEvent) {
		if (event.key === 'Enter' && event.target) {
			const input = event.target as HTMLInputElement;
			const newTag = input.value.trim();
			if (newTag && (!value || !value.includes(newTag))) {
				value = value ? [...value, newTag] : [newTag];
				input.value = '';
			}
		}
	}

	function removeTag(tagToRemove: string) {
		if (value) {
			value = value.filter((tag: string) => tag !== tagToRemove);
		}
	}
</script>

<div class="field-container">
	<label class="block text-sm font-medium text-zinc-300 mb-1">
		{field.label}
		{#if field.required}
			<span class="text-red-400">*</span>
		{/if}
	</label>

	{#if field.type === 'text'}
		{#if readonly}
			<div class="text-zinc-100 py-1">
				{value || '-'}
			</div>
		{:else}
			<input
				type="text"
				bind:value
				placeholder={field.placeholder}
				class="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
			/>
		{/if}

	{:else if field.type === 'textarea'}
		{#if readonly}
			<div class="text-zinc-100 py-1 whitespace-pre-wrap">
				{value || '-'}
			</div>
		{:else}
			<textarea
				bind:value
				placeholder={field.placeholder}
				rows="3"
				class="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none resize-none"
			></textarea>
		{/if}

	{:else if field.type === 'tags'}
		<div class="space-y-2">
			{#if value && value.length > 0}
				<div class="flex flex-wrap gap-1">
					{#each value as tag}
						<span class="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-1 text-xs text-white">
							{tag}
							{#if !readonly}
								<button
									onclick={() => removeTag(tag)}
									class="hover:text-red-300"
								>
									×
								</button>
							{/if}
						</span>
					{/each}
				</div>
			{/if}
			
			{#if !readonly}
				<input
					type="text"
					placeholder={field.placeholder}
					onkeydown={handleTagsInput}
					class="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-1 text-sm text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
				/>
			{/if}
		</div>

	{:else if field.type === 'status'}
		{#if readonly}
			<div class="text-zinc-100 py-1">
				{value || '-'}
			</div>
		{:else}
			<select
				bind:value
				class="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-100 focus:border-blue-500 focus:outline-none"
			>
				<option value="">Select status...</option>
				{#each field.options || [] as option}
					<option value={option}>{option}</option>
				{/each}
			</select>
		{/if}

	{:else if field.type === 'link'}
		{#if readonly}
			{#if value}
				<a
					href={value}
					target="_blank"
					rel="noopener noreferrer"
					class="text-blue-400 hover:text-blue-300 underline"
				>
					{value}
				</a>
			{:else}
				<div class="text-zinc-100 py-1">-</div>
			{/if}
		{:else}
			<input
				type="url"
				bind:value
				placeholder={field.placeholder}
				class="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
			/>
		{/if}

	{:else if field.type === 'date'}
		{#if readonly}
			<div class="text-zinc-100 py-1">
				{value ? new Date(value).toLocaleDateString() : '-'}
			</div>
		{:else}
			<input
				type="date"
				bind:value
				class="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-100 focus:border-blue-500 focus:outline-none"
			/>
		{/if}
	{/if}
</div>