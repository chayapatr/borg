<script lang="ts">
	import { nodeTemplates } from './templates';

	let { position, onCreate, onClose } = $props<{
		position: { x: number; y: number };
		onCreate: (templateType: string) => void;
		onClose: () => void;
	}>();

	let selectedTemplate = $state('');

	function handleCreate() {
		if (selectedTemplate) {
			onCreate(selectedTemplate);
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		} else if (event.key === 'Enter' && selectedTemplate) {
			handleCreate();
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}
</script>

<svelte:window on:keydown={handleKeyDown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-50 flex items-center justify-center" onclick={handleBackdropClick}>
	<div class="w-96 rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
		<h2 class="mb-4 text-lg font-semibold text-zinc-100">Create New Node</h2>

		<div class="space-y-3">
			{#each Object.values(nodeTemplates) as template}
				<label
					class="flex cursor-pointer items-center space-x-3 rounded-lg border border-zinc-700 p-3 hover:bg-zinc-800"
				>
					<input
						type="radio"
						bind:group={selectedTemplate}
						value={template.id}
						class="text-blue-600"
					/>
					<div class="flex items-center space-x-2">
						<div class="h-4 w-4 rounded-full" style="background-color: {template.color};"></div>
						<span class="text-zinc-200">{template.name}</span>
					</div>
				</label>
			{/each}
		</div>

		<div class="mt-6 flex justify-end space-x-3">
			<button
				onclick={onClose}
				class="rounded bg-zinc-700 px-4 py-2 text-zinc-300 hover:bg-zinc-600"
			>
				Cancel
			</button>
			<button
				onclick={handleCreate}
				disabled={!selectedTemplate}
				class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Create
			</button>
		</div>

		<!-- <div class="mt-3 text-xs text-zinc-400">
			Press <kbd class="rounded bg-zinc-800 px-1 py-0.5">Enter</kbd> to create or
			<kbd class="rounded bg-zinc-800 px-1 py-0.5">Escape</kbd> to cancel
		</div> -->
	</div>
</div>
