<script lang="ts">
	import {
		TimelineService,
		timelineTemplates,
		type TimelineEvent
	} from '../../services/local/TimelineService';
	import FieldRenderer from '../fields/FieldRenderer.svelte';

	interface Props {
		onAdd: (templateType: string, eventData: Record<string, any>) => void;
		onClose: () => void;
		editingEvent?: TimelineEvent;
		onUpdate?: (id: string, templateType: string, eventData: Record<string, any>) => void;
	}

	let { onAdd, onClose, editingEvent = undefined, onUpdate = undefined } = $props<Props>();

	let timelineService = new TimelineService();
	let selectedTemplateType = $state(editingEvent?.templateType || 'event');
	let isLoading = $state(false);

	// Initialize eventData with both top-level fields and eventData fields
	let eventData = $state<Record<string, any>>(
		editingEvent
			? {
					title: editingEvent.title,
					date: editingEvent.date,
					time: editingEvent.time,
					timezone: editingEvent.timezone,
					...editingEvent.eventData
				}
			: {
					timezone: '-5 (ET)' // Default timezone for new events
				}
	);

	// Get all available templates
	const templates = timelineService.getAllTemplates();

	// Get current template and its fields
	const currentTemplate = $derived(timelineService.getTemplate(selectedTemplateType));

	async function handleSubmit(event: Event) {
		event.preventDefault();

		if (!eventData.title?.trim()) return;

		isLoading = true;

		try {
			if (editingEvent && onUpdate) {
				const result = onUpdate(editingEvent.id, selectedTemplateType, eventData);
				if (result instanceof Promise) await result;
			} else {
				const result = onAdd(selectedTemplateType, eventData);
				if (result instanceof Promise) await result;
			}
			onClose();
		} catch (error) {
			console.error('Error saving timeline event:', error);
		} finally {
			isLoading = false;
		}
	}

	// Reset form data when template changes (but not when editing)
	$effect(() => {
		if (!editingEvent) {
			// Initialize with default values from template fields
			const newEventData: Record<string, any> = {
				timezone: '-5 (ET)' // Always default to Eastern Time
			};
			currentTemplate.fields.forEach(field => {
				if (field.defaultValue) {
					newEventData[field.id] = field.defaultValue;
				}
			});
			eventData = newEventData;
		}
	});

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
</script>

<svelte:window on:keydown={handleKeyDown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
	onclick={handleBackdropClick}
>
	<div
		class="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-black bg-borg-beige shadow-xl"
	>
		<!-- Header -->
		<div class="border-b border-black p-6">
			<h2 class="text-lg font-semibold text-zinc-900">
				{editingEvent ? 'Edit Timeline Event' : 'Add Timeline Event'}
			</h2>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-6">
			<form onsubmit={handleSubmit} class="space-y-6">
				<!-- Event Type Selection -->
				<div>
					<label class="mb-3 block text-sm font-medium text-zinc-700"> Event Type </label>
					<div class="grid grid-cols-2 gap-3">
						{#each templates as template}
							<button
								type="button"
								disabled={isLoading}
								onclick={() => (selectedTemplateType = template.id)}
								class="flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 {selectedTemplateType ===
								template.id
									? 'border-blue-500 bg-blue-500/10 text-blue-600'
									: 'border-black bg-white text-zinc-700 hover:border-black hover:bg-borg-beige'}"
							>
								<div
									class="h-3 w-3 flex-shrink-0 rounded-full"
									style="background-color: {template.color}"
								></div>
								<div>
									<div class="font-medium">{template.name}</div>
									<div class="text-xs opacity-70">
										{#if template.id === 'conference'}
											Conferences, workshops
										{:else if template.id === 'grant'}
											Funding deadlines
										{:else if template.id === 'deadline'}
											Important dates
										{:else}
											General events
										{/if}
									</div>
								</div>
							</button>
						{/each}
					</div>
				</div>

				<!-- Dynamic fields based on selected template -->
				{#each currentTemplate.fields as field, index}
					{#if field.id === 'time'}
						<!-- Special handling for time field - combine with timezone on one line -->
						{@const timezoneField = currentTemplate.fields.find(f => f.id === 'timezone')}
						{#if timezoneField}
							<div>
								<label class="mb-1 block text-sm font-medium text-zinc-600">Time & Timezone</label>
								<div class="flex gap-3">
									<div class="flex-1">
										<input
											type="time"
											bind:value={eventData[field.id]}
											placeholder={field.placeholder}
											disabled={isLoading}
											class="w-full rounded border border-black bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-100"
										/>
									</div>
									<div class="w-40">
										<select
											bind:value={eventData[timezoneField.id]}
											disabled={isLoading}
											class="w-full rounded border border-black bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-100"
										>
											{#each timezoneField.options || [] as option}
												<option value={option}>
													{option}
												</option>
											{/each}
										</select>
									</div>
								</div>
							</div>
						{:else}
							<div>
								<FieldRenderer
									{field}
									bind:value={eventData[field.id]}
									readonly={isLoading}
									mode="edit"
								/>
							</div>
						{/if}
					{:else if field.id === 'timezone'}
						<!-- Skip timezone field as it's handled with time field -->
					{:else}
						<div>
							<FieldRenderer
								{field}
								bind:value={eventData[field.id]}
								readonly={isLoading}
								mode="edit"
							/>
						</div>
					{/if}
				{/each}
			</form>
		</div>

		<!-- Footer -->
		<div class="flex gap-3 border-t border-black p-6">
			<button
				type="button"
				onclick={onClose}
				disabled={isLoading}
				class="flex-1 rounded bg-white px-4 py-2 text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
			>
				Cancel
			</button>
			<button
				onclick={handleSubmit}
				disabled={!eventData.title?.trim() || isLoading}
				class="flex flex-1 items-center justify-center gap-2 rounded bg-borg-violet px-4 py-2 text-white transition-colors hover:bg-borg-blue disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if isLoading}
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
					></div>
					Saving...
				{:else}
					{editingEvent ? 'Update Event' : 'Add Event'}
				{/if}
			</button>
		</div>
	</div>
</div>
