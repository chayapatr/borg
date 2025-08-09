<script lang="ts">
	import type { ITimelineService } from '../../services/interfaces/ITimelineService';
	import type { TimelineEvent } from '../../services/local/TimelineService';
	import AddTimelineEventModal from './AddTimelineEventModal.svelte';
	import { CalendarPlus, Calendar, DollarSign, Clock, Fish } from '@lucide/svelte';

	let { timelineService, activeTab } = $props<{
		timelineService: ITimelineService;
		activeTab: string;
	}>();

	let events = $state<TimelineEvent[]>([]);
	let showAddModal = $state(false);
	let editingEvent = $state<TimelineEvent | undefined>(undefined);
	let dataLoaded = $state(false);

	// Lazy load data when tab becomes active
	$effect(() => {
		if (activeTab === 'timeline' && !dataLoaded) {
			loadEvents();
		}
	});

	async function loadEvents(force = false) {
		if (dataLoaded && !force) return; // Prevent duplicate loading unless forced
		
		const result = timelineService.getEventsSortedByDate();
		events = result instanceof Promise ? await result : result;
		dataLoaded = true;
	}

	async function handleAddEvent(templateType: string, eventData: Record<string, any>) {
		const result = timelineService.addEvent(templateType, eventData);
		if (result instanceof Promise) await result;
		await loadEvents(true); // Force reload to get new event
		showAddModal = false;
	}

	async function handleUpdateEvent(
		id: string,
		templateType: string,
		eventData: Record<string, any>
	) {
		// Filter out undefined values and separate top-level fields from eventData
		const { title, date, ...dynamicEventData } = eventData;

		const updates = {
			templateType,
			title: title || 'Untitled Event',
			date: date || new Date().toISOString().split('T')[0],
			eventData: dynamicEventData
		};

		// Remove any undefined values
		Object.keys(updates).forEach((key) => {
			if ((updates as any)[key] === undefined) {
				delete (updates as any)[key];
			}
		});

		const result = timelineService.updateEvent(id, updates);
		if (result instanceof Promise) await result;
		await loadEvents(true); // Force reload
		showAddModal = false;
		editingEvent = undefined;
	}

	function handleEditEvent(event: TimelineEvent) {
		editingEvent = event;
		showAddModal = true;
	}

	function handleCloseModal() {
		showAddModal = false;
		editingEvent = undefined;
	}

	async function handleDeleteEvent(id: string) {
		if (confirm('Are you sure you want to delete this event?')) {
			const result = timelineService.deleteEvent(id);
			if (result instanceof Promise) await result;
			await loadEvents(true); // Force reload
		}
	}

	function formatDate(dateString: string) {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function isUpcoming(dateString: string) {
		return new Date(dateString) >= new Date();
	}

	function getTemplateInfo(templateType: string) {
		const template = timelineService.getTemplate(templateType);
		return {
			name: template.name,
			color: template.color,
			icon: template.icon
		};
	}
</script>

<div class="flex flex-1 flex-col">
	<!-- Header -->
	<!-- <div class="p-6 border-b border-zinc-800">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-2xl font-semibold text-zinc-100">Timeline</h2>
				<p class="text-zinc-400 mt-1">Track conferences and important dates</p>
			</div>
			<button
				onclick={() => (showAddModal = true)}
				class="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
				</svg>
				Add Event
			</button>
		</div>
	</div> -->
	<div class=" border-b bg-white px-6 py-4">
		<div class="flex items-center justify-between">
			<div>
				<div class="flex items-center gap-3">
					<Calendar class="h-10 w-10" />
					<h2 class="rounded-md text-4xl font-semibold">Timeline</h2>
				</div>
				<!-- <p class="text-zinc-400 mt-1">Manage your research projects</p> -->
			</div>
			<button
				class="transition- flex items-center gap-2 rounded-full border border-white bg-borg-blue px-4 py-2 text-white transition-all hover:cursor-pointer hover:bg-black
				"
				onclick={() => (showAddModal = true)}
			>
				<CalendarPlus class="h-4 w-4" />
				New Event
			</button>
		</div>
	</div>

	<!-- Timeline Events -->
	<div class="flex-1 overflow-y-auto p-6">
		{#if events.length === 0}
			<div class="flex h-64 flex-col items-center justify-center text-center">
				<Fish class="mb-4 h-8 w-8" />

				<h3 class="mb-2 text-xl font-medium text-black">No events yet</h3>
				<p class="mb-4 text-zinc-500">Add your first conference, deadline, or event</p>
				<!-- <button
					onclick={() => (showAddModal = true)}
					class="rounded-lg bg-borg-blue px-4 py-2 text-white transition-colors hover:bg-blue-500"
				>
					Add Event
				</button> -->
			</div>
		{:else}
			<div class="space-y-4">
				{#each events as event}
					{@const template = getTemplateInfo(event.templateType)}
					<div
						class="box-shadow-black cursor-pointer rounded-lg border border-black bg-white p-4 transition-colors hover:bg-zinc-50"
						role="button"
						tabindex="0"
						onclick={() => handleEditEvent(event)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								handleEditEvent(event);
							}
						}}
					>
						<div class="flex items-start justify-between">
							<div class="flex flex-1 items-start gap-3">
								<div
									class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
									style="background-color: {template.color}20; border: 1px solid {template.color}40;"
								>
									<svg
										class="h-5 w-5"
										style="color: {template.color}"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										{#if template.icon === 'calendar'}
											<Calendar />
										{:else if template.icon === 'clock'}
											<Clock />
										{:else if template.icon === 'dollar-sign'}
											<DollarSign />
										{:else}
											<Calendar />
										{/if}
									</svg>
								</div>
								<div class="flex-1">
									<div class="mb-1 flex items-center gap-2">
										<h3 class="font-medium text-black">{event.title}</h3>
										<span class="rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
											{template.name}
										</span>
									</div>
									<div class="mb-2 flex items-center gap-4 text-sm text-zinc-400">
										<span class="flex items-center gap-1">
											<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
												/>
											</svg>
											{formatDate(event.date)}
										</span>
										{#if isUpcoming(event.date)}
											<span class="text-xs text-borg-green">Upcoming</span>
										{:else}
											<span class="text-xs text-zinc-500">Past</span>
										{/if}
									</div>
									{#if event.eventData.description}
										<p class="line-clamp-2 text-sm text-zinc-400">{event.eventData.description}</p>
									{/if}
								</div>
							</div>
							<button
								onclick={(e) => {
									e.stopPropagation();
									handleDeleteEvent(event.id);
								}}
								class="ml-2 text-zinc-500 transition-colors hover:text-red-400"
								aria-label="Delete event"
							>
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
									/>
								</svg>
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

{#if showAddModal}
	<AddTimelineEventModal
		onAdd={handleAddEvent}
		onUpdate={handleUpdateEvent}
		onClose={handleCloseModal}
		{editingEvent}
	/>
{/if}
