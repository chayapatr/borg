<script lang="ts">
	import type { TemplateField } from './templates';

	let {
		field,
		value = $bindable(),
		readonly = false
	} = $props<{
		field: TemplateField;
		value: any;
		readonly?: boolean;
	}>();

	let showTagInput = $state(false);
	let editingButton = $state(false);

	function handleTagsInput(event: KeyboardEvent) {
		if (event.key === 'Enter' && event.target) {
			const input = event.target as HTMLInputElement;
			const newTag = input.value.trim();
			if (newTag) {
				// Initialize as empty array if undefined
				if (!value || !Array.isArray(value)) {
					value = [];
				}
				if (!value.includes(newTag)) {
					value = [...value, newTag];
					input.value = '';
					showTagInput = false;
				}
			}
		} else if (event.key === 'Escape') {
			showTagInput = false;
		}
	}

	function removeTag(tagToRemove: string) {
		if (value && Array.isArray(value)) {
			value = value.filter((tag: string) => tag !== tagToRemove);
		}
	}

	function getStatusColor(status: string): string {
		const statusColors: Record<string, string> = {
			// Project statuses
			Planning: 'bg-yellow-500/20 text-yellow-400',
			Active: 'bg-green-500/20 text-green-400',
			'On Hold': 'bg-orange-500/20 text-orange-400',
			Completed: 'bg-blue-500/20 text-blue-400',

			// Paper statuses
			Draft: 'bg-gray-500/20 text-gray-400',
			'In Review': 'bg-yellow-500/20 text-yellow-400',
			'Under Revision': 'bg-orange-500/20 text-orange-400',
			Accepted: 'bg-green-500/20 text-green-400',
			Published: 'bg-blue-500/20 text-blue-400'
		};

		return statusColors[status] || 'bg-zinc-500/20 text-zinc-400';
	}
</script>

<div class="field-container">
	<label class="mb-1 block text-sm font-medium text-zinc-300">
		{field.label}
	</label>

	{#if field.type === 'text'}
		{#if readonly}
			<div class="py-1 text-zinc-100">
				{value || '-'}
			</div>
		{:else}
			<input
				type="text"
				bind:value
				placeholder={field.placeholder}
				class="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
			/>
		{/if}
	{:else if field.type === 'textarea'}
		{#if readonly}
			<div class="py-1 whitespace-pre-wrap text-zinc-100">
				{value || '-'}
			</div>
		{:else}
			<textarea
				bind:value
				placeholder={field.placeholder}
				rows="3"
				class="w-full resize-none rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
			></textarea>
		{/if}
	{:else if field.type === 'tags'}
		<div class="space-y-2">
			<div class="flex flex-wrap gap-1">
				{#if value && Array.isArray(value) && value.length > 0}
					{#each value as tag}
						<span
							class="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-1 text-xs text-white"
						>
							{tag}
							{#if !readonly}
								<button onclick={() => removeTag(tag)} class="hover:text-red-300"> × </button>
							{/if}
						</span>
					{/each}
				{/if}

				{#if !readonly}
					<div class="relative">
						<button
							type="button"
							onclick={() => (showTagInput = !showTagInput)}
							class="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
						>
							<span>+</span>
						</button>

						{#if showTagInput}
							<input
								type="text"
								placeholder={field.placeholder}
								onkeydown={handleTagsInput}
								onblur={() => (showTagInput = false)}
								class="absolute top-0 left-0 z-10 w-32 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
								autofocus
							/>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{:else if field.type === 'status'}
		<div class="space-y-2">
			{#if readonly}
				{#if value}
					<span
						class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium {getStatusColor(
							value
						)}"
					>
						{value}
					</span>
				{:else}
					<div class="py-1 text-zinc-100">-</div>
				{/if}
			{:else}
				<div class="flex flex-wrap gap-2">
					{#each field.options || [] as option}
						<button
							type="button"
							onclick={() => (value = value === option ? '' : option)}
							class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors {value ===
							option
								? getStatusColor(option)
								: 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}"
						>
							{option}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{:else if field.type === 'link'}
		{#if readonly}
			{#if value}
				<a
					href={value}
					target="_blank"
					rel="noopener noreferrer"
					class="text-blue-400 underline hover:text-blue-300"
				>
					{value}
				</a>
			{:else}
				<div class="py-1 text-zinc-100">-</div>
			{/if}
		{:else}
			<input
				type="url"
				bind:value
				placeholder={field.placeholder}
				class="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
			/>
		{/if}
	{:else if field.type === 'date'}
		{#if readonly}
			<div class="py-1 text-zinc-100">
				{value ? new Date(value).toLocaleDateString() : '-'}
			</div>
		{:else}
			<input
				type="date"
				bind:value
				class="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-blue-500 focus:outline-none"
			/>
		{/if}
	{:else if field.type === 'button'}
		{#if readonly}
			{#if value}
				<button
					onclick={() => window.open(value, '_blank')}
					class="w-full rounded-lg bg-zinc-600 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-500 focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:outline-none"
				>
					{field.buttonText || 'Open'}
				</button>
			{:else}
				<div class="py-1 text-zinc-100">-</div>
			{/if}
		{:else if value && !editingButton}
			<div class="flex gap-2">
				<button
					onclick={() => window.open(value, '_blank')}
					class="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-700 focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:outline-none"
				>
					{field.buttonText || 'Open'}
				</button>
				<button
					onclick={() => (editingButton = true)}
					class="rounded p-2 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
					aria-label="Edit URL"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
						/>
					</svg>
				</button>
			</div>
		{:else}
			<div class="flex gap-2">
				<input
					type="url"
					bind:value
					placeholder="Enter URL..."
					class="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
				/>
				<button
					onclick={() => {
						editingButton = false;
					}}
					class="rounded-lg bg-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-500 focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					disabled={!value}
				>
					Done
				</button>
			</div>
		{/if}
	{/if}
</div>
