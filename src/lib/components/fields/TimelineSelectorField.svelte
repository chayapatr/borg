<script lang="ts">
	import { ServiceFactory } from '../../services/ServiceFactory';
	import type { TemplateField } from '../../templates';
	import AddTimelineEventModal from '../browser/AddTimelineEventModal.svelte';
	import { Plus } from '@lucide/svelte';

	let {
		field,
		value = $bindable(),
		readonly = false,
		mode = 'display',
		countdownOnly = false
	} = $props<{
		field: TemplateField;
		value: any;
		readonly?: boolean;
		mode?: 'display' | 'edit';
		countdownOnly?: boolean;
	}>();

	// Services for synced data
	const timelineService = ServiceFactory.createTimelineService();

	// State for timeline data
	let allEvents = $state<any[]>([]);
	let eventsMap = $state<Map<string, any>>(new Map());
	let showAddModal = $state(false);

	// Countdown calculation function
	function calculateCountdown(targetDate: string): {
		days: number;
		hours: number;
		minutes: number;
		isOverdue: boolean;
	} {
		const now = new Date();
		const target = new Date(targetDate);
		const diffMs = target.getTime() - now.getTime();

		if (diffMs <= 0) {
			return { days: 0, hours: 0, minutes: 0, isOverdue: true };
		}

		const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

		return { days, hours, minutes, isOverdue: false };
	}

	// Update countdown every 30 seconds for live updates
	let countdownRefreshKey = $state(0);
	let countdownInterval: ReturnType<typeof setInterval>;

	$effect(() => {
		// Start interval when component mounts
		countdownInterval = setInterval(() => {
			countdownRefreshKey++;
		}, 30000); // Update every 30 seconds

		// Cleanup interval on unmount
		return () => {
			if (countdownInterval) {
				clearInterval(countdownInterval);
			}
		};
	});

	// Load timeline data reactively
	$effect(() => {
		loadEvents();
	});

	async function loadEvents() {
		if (timelineService.getEventsSortedByDate) {
			const result = timelineService.getEventsSortedByDate();
			const events = result instanceof Promise ? await result : result;
			allEvents = events;

			// Create a map for quick lookup
			const map = new Map();
			events.forEach((event) => map.set(event.id, event));
			eventsMap = map;
		}
	}

	async function handleAddEvent(templateType: string, eventData: Record<string, any>) {
		const result = timelineService.addEvent(templateType, eventData);
		if (result instanceof Promise) await result;
		await loadEvents(); // Reload events to get the new one
		showAddModal = false;

		// If this was successful, find the newly created event and select it
		const updatedResult = timelineService.getEventsSortedByDate();
		const updatedEvents = updatedResult instanceof Promise ? await updatedResult : updatedResult;
		const newEvent = updatedEvents.find(
			(e) => e.title === eventData.title && e.date === eventData.date
		);
		if (newEvent) {
			value = newEvent.id;
		}
	}

	function handleCloseModal() {
		showAddModal = false;
	}
</script>

<div class="field-container">
	{#if !(countdownOnly && mode === 'display')}
		<label for="timeline-select-{field.id}" class="mb-1 block text-sm font-medium text-zinc-600">
			{field.label}
		</label>
	{/if}

	{#if mode === 'display'}
		{#if value}
			{@const event = eventsMap.get(value)}
			{#if event}
				{#if countdownOnly}
					<!-- Countdown-only mode: large, centered display -->
					{@const countdown = (() => {
						countdownRefreshKey;
						return calculateCountdown(event.date);
					})()}
					<div class="py-2 text-center">
						<div class="font-sanss mb-3 text-lg font-semibold text-black">{event.title}</div>
						{#if countdown.isOverdue}
							<div class="font-mono text-2xl font-bold text-red-600">⚠️ OVERDUE</div>
						{:else}
							<div class="flex justify-center gap-4">
								{#if countdown.days > 0}
									<div class="flex flex-col items-center">
										<div class="font-mono text-3xl font-bold text-borg-blue">
											{countdown.days.toString().padStart(2, '0')}
										</div>
										<div class="text-sm font-medium text-zinc-600">
											Day{countdown.days !== 1 ? 's' : ''}
										</div>
									</div>
								{/if}
								{#if countdown.days > 0 || countdown.hours > 0}
									<div class="flex flex-col items-center">
										<div class="font-mono text-3xl font-bold text-borg-blue">
											{countdown.hours.toString().padStart(2, '0')}
										</div>
										<div class="text-sm font-medium text-zinc-600">
											Hr{countdown.hours !== 1 ? 's' : ''}
										</div>
									</div>
								{/if}
								<div class="flex flex-col items-center">
									<div class="font-mono text-3xl font-bold text-borg-blue">
										{countdown.minutes.toString().padStart(2, '0')}
									</div>
									<div class="text-sm font-medium text-zinc-600">
										Min{countdown.minutes !== 1 ? 's' : ''}
									</div>
								</div>
							</div>
						{/if}
					</div>
				{:else}
					<!-- Normal mode: standard display -->
					<div class="py-1 text-black">
						<div class="font-medium">{event.title}</div>
						<div class="text-sm text-zinc-600">
							{new Date(event.date).toLocaleDateString()} • {event.templateType || 'Event'}
						</div>
					</div>
				{/if}
			{:else}
				<div class="py-1 text-zinc-600">Event not found</div>
			{/if}
		{:else}
			<div class="py-1 text-zinc-600">No event selected</div>
		{/if}
	{:else}
		<div class="flex gap-2">
			<select
				id="timeline-select-{field.id}"
				bind:value
				class="min-w-0 flex-1 rounded border border-zinc-700 bg-white px-3 py-2 text-black focus:border-borg-blue focus:outline-none"
			>
				<option value="">Select timeline event...</option>
				{#each allEvents as event}
					<option value={event.id}>
						{event.title} ({new Date(event.date).toLocaleDateString()}) - {event.templateType ||
							'Event'}
					</option>
				{/each}
			</select>
			<button
				type="button"
				onclick={() => (showAddModal = true)}
				class="flex flex-shrink-0 items-center gap-1 rounded border border-borg-blue bg-borg-blue px-2 py-2 text-white transition-colors hover:bg-blue-600"
				title="Add New Event"
			>
				<Plus class="h-4 w-4" />
				<span class="hidden text-sm lg:inline">New</span>
			</button>
		</div>
	{/if}
</div>

{#if showAddModal}
	<AddTimelineEventModal onAdd={handleAddEvent} onClose={handleCloseModal} />
{/if}
