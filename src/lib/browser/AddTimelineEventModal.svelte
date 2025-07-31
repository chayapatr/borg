<script lang="ts">
	import { TimelineService, timelineTemplates } from '../services/TimelineService';
	import FieldRenderer from '../FieldRenderer.svelte';

	let {
		onAdd,
		onClose
	} = $props<{
		onAdd: (templateType: string, eventData: Record<string, any>) => void;
		onClose: () => void;
	}>();

	let timelineService = new TimelineService();
	let selectedTemplate = $state('conference');
	let eventData = $state<Record<string, any>>({});
	let selectedPredefined = $state('');

	// Reset data when template changes
	$effect(() => {
		const template = timelineService.getTemplate(selectedTemplate);
		const initialData: Record<string, any> = {};
		
		template.fields.forEach((field) => {
			if (field.type === 'tags') {
				initialData[field.id] = [];
			} else {
				initialData[field.id] = '';
			}
		});
		
		eventData = initialData;
		selectedPredefined = '';
	});

	function handleTemplateChange(templateType: string) {
		selectedTemplate = templateType;
	}

	function handlePredefinedSelect() {
		if (!selectedPredefined) return;
		
		const template = timelineService.getTemplate(selectedTemplate);
		const predefinedOption = template.predefinedOptions?.find(opt => opt.id === selectedPredefined);
		
		if (predefinedOption) {
			// Merge predefined data with current eventData
			eventData = { ...eventData, ...predefinedOption };
		}
	}

	function handleSubmit(event: Event) {
		event.preventDefault();
		
		if (!eventData.title?.trim()) return;

		onAdd(selectedTemplate, eventData);
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	let currentTemplate = $derived(timelineService.getTemplate(selectedTemplate));
	let predefinedOptions = $derived(currentTemplate.predefinedOptions || []);
</script>

<svelte:window on:keydown={handleKeyDown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
	onclick={handleBackdropClick}
>
	<div class="w-full max-w-2xl max-h-[90vh] rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl flex flex-col">
		<!-- Header -->
		<div class="p-6 border-b border-zinc-700">
			<h2 class="text-lg font-semibold text-zinc-100">Add Timeline Event</h2>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-6">
			<form onsubmit={handleSubmit} class="space-y-6">
				<!-- Template Selection -->
				<div>
					<label class="mb-2 block text-sm font-medium text-zinc-300">
						Event Type
					</label>
					<div class="grid grid-cols-2 gap-3">
						{#each Object.values(timelineTemplates) as template}
							<button
								type="button"
								onclick={() => handleTemplateChange(template.id)}
								class="flex items-center gap-3 rounded-lg border p-3 text-left transition-all {selectedTemplate === template.id
									? 'border-blue-500 bg-blue-500/10'
									: 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800'}"
							>
								<div 
									class="w-8 h-8 rounded-lg flex items-center justify-center"
									style="background-color: {template.color}20; border: 1px solid {template.color}40;"
								>
									<svg class="w-4 h-4" style="color: {template.color}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										{#if template.icon === 'calendar'}
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
										{:else if template.icon === 'clock'}
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
										{:else if template.icon === 'dollar-sign'}
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
										{:else}
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
										{/if}
									</svg>
								</div>
								<span class="font-medium text-zinc-100">{template.name}</span>
							</button>
						{/each}
					</div>
				</div>

				<!-- Predefined Options (for conferences) -->
				{#if predefinedOptions.length > 0}
					<div>
						<label class="mb-2 block text-sm font-medium text-zinc-300">
							Quick Select (optional)
						</label>
						<div class="flex gap-2">
							<select
								bind:value={selectedPredefined}
								class="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-blue-500 focus:outline-none"
							>
								<option value="">Select a predefined option...</option>
								{#each predefinedOptions as option}
									<option value={option.id}>{option.title}</option>
								{/each}
							</select>
							<button
								type="button"
								onclick={handlePredefinedSelect}
								disabled={!selectedPredefined}
								class="rounded bg-zinc-700 px-4 py-2 text-zinc-300 transition-colors hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
							>
								Use
							</button>
						</div>
					</div>
				{/if}

				<!-- Dynamic Fields -->
				<div class="space-y-4">
					{#each currentTemplate.fields as field}
						<FieldRenderer {field} bind:value={eventData[field.id]} readonly={false} mode="edit" />
					{/each}
				</div>
			</form>
		</div>

		<!-- Footer -->
		<div class="flex gap-3 p-6 border-t border-zinc-700">
			<button
				type="button"
				onclick={onClose}
				class="flex-1 rounded bg-zinc-700 px-4 py-2 text-zinc-300 transition-colors hover:bg-zinc-600"
			>
				Cancel
			</button>
			<button
				onclick={handleSubmit}
				disabled={!eventData.title?.trim()}
				class="flex-1 rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Add Event
			</button>
		</div>
	</div>
</div>