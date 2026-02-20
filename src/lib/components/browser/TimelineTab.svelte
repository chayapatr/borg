<script lang="ts">
	import type { ITimelineService } from '../../services/interfaces/ITimelineService';
	import type { TimelineEvent } from '$lib/types/timeline';
	import AddTimelineEventModal from './AddTimelineEventModal.svelte';
	import { CalendarPlus, Calendar, DollarSign, Clock, Fish } from '@lucide/svelte';

	let { timelineService, activeTab } = $props<{
		timelineService: ITimelineService;
		activeTab: string;
	}>();

	let events = $state<TimelineEvent[]>([]);
	let upcomingEvents = $state<TimelineEvent[]>([]);
	let pastEvents = $state<TimelineEvent[]>([]);
	let filteredUpcomingEvents = $state<TimelineEvent[]>([]);
	let filteredPastEvents = $state<TimelineEvent[]>([]);
	let showAddModal = $state(false);
	let editingEvent = $state<TimelineEvent | undefined>(undefined);
	let dataLoaded = $state(false);
	let selectedTab = $state<'upcoming' | 'past'>('upcoming');
	let selectedTypeFilter = $state<string>('all');

	// Lazy load data when tab becomes active
	$effect(() => {
		if (activeTab === 'timeline' && !dataLoaded) {
			loadEvents();
		}
	});

	async function loadEvents(force = false) {
		if (dataLoaded && !force) return; // Prevent duplicate loading unless forced

		const result = timelineService.getEventsSortedByDate();
		const allEvents = result instanceof Promise ? await result : result;

		const now = new Date();

		// Split events into upcoming and past
		const upcoming: TimelineEvent[] = [];
		const past: TimelineEvent[] = [];

		allEvents.forEach((event) => {
			const eventDate = event.timestamp
				? new Date(event.timestamp)
				: (event as any).date
					? new Date((event as any).date)
					: new Date(0);
			if (eventDate >= now) {
				upcoming.push(event);
			} else {
				past.push(event);
			}
		});

		// Sort upcoming events by deadline (soonest first)
		upcomingEvents = upcoming.sort((a, b) => {
			const dateA = a.timestamp
				? new Date(a.timestamp)
				: (a as any).date
					? new Date((a as any).date)
					: new Date(0);
			const dateB = b.timestamp
				? new Date(b.timestamp)
				: (b as any).date
					? new Date((b as any).date)
					: new Date(0);
			return dateA.getTime() - dateB.getTime();
		});

		// Sort past events by deadline (most recent first)
		pastEvents = past.sort((a, b) => {
			const dateA = a.timestamp
				? new Date(a.timestamp)
				: (a as any).date
					? new Date((a as any).date)
					: new Date(0);
			const dateB = b.timestamp
				? new Date(b.timestamp)
				: (b as any).date
					? new Date((b as any).date)
					: new Date(0);
			return dateB.getTime() - dateA.getTime();
		});

		events = allEvents; // Keep all events for compatibility
		applyTypeFilter();
		dataLoaded = true;
	}

	// Apply type filter to events
	function applyTypeFilter() {
		if (selectedTypeFilter === 'all') {
			filteredUpcomingEvents = upcomingEvents;
			filteredPastEvents = pastEvents;
		} else {
			filteredUpcomingEvents = upcomingEvents.filter(
				(event) => event.templateType === selectedTypeFilter
			);
			filteredPastEvents = pastEvents.filter((event) => event.templateType === selectedTypeFilter);
		}
	}

	// React to filter changes
	$effect(() => {
		applyTypeFilter();
	});

	// Get unique template types from all events
	let availableTypes = $derived.by(() => {
		const types = new Set<string>();
		events.forEach((event) => types.add(event.templateType));
		return Array.from(types).map((type) => ({
			value: type,
			label: getTemplateInfo(type).name
		}));
	});

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
		const { title, timestamp, ...dynamicEventData } = eventData;

		const updates = {
			templateType,
			title: title || 'Untitled Event',
			timestamp: timestamp || new Date().toISOString(),
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

	function formatDateTime(event: TimelineEvent) {
		// Extract timezone from timestamp if available
		if (event.timestamp && event.timestamp.includes('T')) {
			const timezoneMatch = event.timestamp.match(/([+-]\d{1,2}):\d{2}$/);
			const offset = timezoneMatch?.[1];
			const timezone =
				offset === '-5'
					? 'EST'
					: offset === '-4'
						? 'EDT'
						: offset === '-12'
							? 'AOE'
							: offset === '+0'
								? 'UTC'
								: `UTC${offset}`;

			// Parse the timestamp and format it directly to preserve the original timezone time
			const datePart = event.timestamp.split('T')[0];
			const timePart = event.timestamp.split('T')[1];
			const timeOnly = timePart.split(/[+-]/)[0];
			const timeComponents = timeOnly.split(':');
			const timeStr = `${timeComponents[0]}:${timeComponents[1]}`;

			// Parse the date components manually to avoid timezone conversion issues
			const [year, month, day] = datePart.split('-').map(Number);
			const dateStr = new Date(year, month - 1, day).toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			});

			return `${dateStr} at ${timeStr} ${timezone}`;
		}

		// Fallback for legacy events
		const timestamp = event.timestamp || (event as any).date;
		if (timestamp && typeof timestamp === 'string' && timestamp.includes('T')) {
			// Handle ISO timestamps in fallback case
			const datePart = timestamp.split('T')[0];
			const [year, month, day] = datePart.split('-').map(Number);
			const date = new Date(year, month - 1, day);
			const dateStr = date.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			});
			
			// For time, we can use the original timestamp since time zones are handled correctly
			const originalDate = new Date(timestamp);
			const timeStr = originalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
			
			return `${dateStr} at ${timeStr}`;
		} else {
			// Handle other date formats or create new date
			const date = timestamp ? new Date(timestamp) : new Date();
			const dateStr = date.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			});
			const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

			return `${dateStr} at ${timeStr}`;
		}
	}

	function isUpcoming(event: TimelineEvent) {
		const eventDate = event.timestamp
			? new Date(event.timestamp)
			: (event as any).date
				? new Date((event as any).date)
				: new Date();
		return eventDate >= new Date();
	}

	function getTemplateInfo(templateType: string) {
		const template = timelineService.getTemplate(templateType);
		return {
			name: template.name,
			color: template.color,
			icon: template.icon
		};
	}

	function getTimeLeft(event: TimelineEvent): {
		days: number;
		hours: number;
		minutes: number;
		isOverdue: boolean;
		displayText: string;
	} {
		const now = new Date();
		const target = event.timestamp
			? new Date(event.timestamp)
			: (event as any).date
				? new Date((event as any).date)
				: new Date();

		const diffMs = target.getTime() - now.getTime();

		if (diffMs <= 0) {
			return { days: 0, hours: 0, minutes: 0, isOverdue: true, displayText: 'Past' };
		}

		const totalMinutes = Math.floor(diffMs / (1000 * 60));
		const days = Math.floor(totalMinutes / (24 * 60));
		const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
		const minutes = totalMinutes % 60;

		let displayText: string;
		if (days >= 1) {
			displayText = `${days} day${days !== 1 ? 's' : ''} left`;
		} else if (hours > 0) {
			displayText = `${hours}h ${minutes}m left`;
		} else {
			displayText = `${minutes}m left`;
		}

		return { days, hours, minutes, isOverdue: false, displayText };
	}

	function getTimeLeftColor(timeLeft: { days: number; hours: number; isOverdue: boolean }): string {
		if (timeLeft.isOverdue) return 'text-rose-500';
		if (timeLeft.days === 0) return 'text-rose-400'; // Same day - urgent
		if (timeLeft.days === 1) return 'text-orange-600'; // Tomorrow - warning
		if (timeLeft.days <= 7) return 'text-amber-500'; // Within a week - caution
		return 'text-borg-blue'; // More than a week - normal
	}
</script>

<div class="flex flex-1 flex-col">
	<!-- Header -->
	<div class=" flex h-16 flex-col justify-center border-b bg-white px-6">
		<div class="flex items-center justify-between">
			<div>
				<div class="flex items-center gap-3">
					<Calendar class="h-8 w-8" />
					<h2 class="rounded-md text-3xl font-semibold">Timeline</h2>
				</div>
			</div>
			<button
				class="transition- flex items-center gap-2 rounded-full border border-white bg-borg-violet px-4 py-2 text-white transition-all hover:cursor-pointer hover:bg-black
				"
				onclick={() => (showAddModal = true)}
			>
				<CalendarPlus class="h-4 w-4" />
				New Event
			</button>
		</div>
	</div>

	<!-- Sub-tabs for Upcoming/Past -->
	<div class="border-b bg-white px-6">
		<div class="flex items-center justify-between">
			<div class="flex space-x-8">
				<button
					class="border-b-2 py-3 text-sm font-medium transition-colors {selectedTab === 'upcoming'
						? 'border-borg-blue text-borg-blue'
						: 'border-transparent text-zinc-500 hover:text-zinc-700'}"
					onclick={() => (selectedTab = 'upcoming')}
				>
					Upcoming ({filteredUpcomingEvents.length})
				</button>
				<button
					class="border-b-2 py-3 text-sm font-medium transition-colors {selectedTab === 'past'
						? 'border-borg-blue text-borg-blue'
						: 'border-transparent text-zinc-500 hover:text-zinc-700'}"
					onclick={() => (selectedTab = 'past')}
				>
					Past ({filteredPastEvents.length})
				</button>
			</div>
			<!-- Filter by Type -->
			<div class="flex items-center gap-2">
				<span class="text-xs text-zinc-500">Filter:</span>
				<select
					bind:value={selectedTypeFilter}
					class="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-black focus:border-borg-blue focus:outline-none"
				>
					<option value="all">All Types</option>
					{#each availableTypes as type}
						<option value={type.value}>{type.label}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	<!-- Timeline Events -->
	<div class="flex-1 overflow-y-auto p-6">
		{#if selectedTab === 'upcoming'}
			{@const currentEvents = filteredUpcomingEvents}
			{#if currentEvents.length === 0}
				<div class="flex h-64 flex-col items-center justify-center text-center">
					<Fish class="mb-4 h-8 w-8" />

					<h3 class="mb-2 text-xl font-medium text-black">No upcoming events</h3>
					<p class="mb-4 text-zinc-500">Add your first conference, deadline, or event</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-4">
					{#each currentEvents as event}
						{@const template = getTemplateInfo(event.templateType)}
						{@const timeLeft = getTimeLeft(event)}
						<div
							class="box-shadow-black cursor-pointer rounded-lg border border-black bg-white p-3 transition-colors hover:bg-zinc-50"
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
										class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg"
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
											<span
												class="rounded-full bg-borg-beige px-2 py-[0.15rem] text-[11px] text-zinc-600"
											>
												{template.name}
											</span>
										</div>
										<div class="mb-2 flex items-center gap-4 text-xs text-zinc-600">
											<span class="flex items-center gap-1">
												<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
													/>
												</svg>
												{formatDateTime(event)}
											</span>
											{#if !timeLeft.isOverdue}
												<span class="font-mono text-xs font-bold {getTimeLeftColor(timeLeft)}">
													{timeLeft.displayText}
												</span>
											{:else}
												<span class="text-xs text-zinc-500">Past</span>
											{/if}
										</div>
										{#if event.eventData.description}
											<p class="line-clamp-2 border-zinc-600 text-xs">
												{event.eventData.description}
											</p>
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
		{:else}
			{@const currentEvents = filteredPastEvents}
			{#if currentEvents.length === 0}
				<div class="flex h-64 flex-col items-center justify-center text-center">
					<Fish class="mb-4 h-8 w-8" />

					<h3 class="mb-2 text-xl font-medium text-black">No past events</h3>
					<p class="mb-4 text-zinc-500">Past events will appear here</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-4">
					{#each currentEvents as event}
						{@const template = getTemplateInfo(event.templateType)}
						{@const timeLeft = getTimeLeft(event)}
						<div
							class="box-shadow-black cursor-pointer rounded-lg border border-black bg-white p-3 transition-colors hover:bg-zinc-50"
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
										class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg"
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
											<span
												class="rounded-full bg-borg-beige px-2 py-[0.15rem] text-[11px] text-zinc-600"
											>
												{template.name}
											</span>
										</div>
										<div class="mb-2 flex items-center gap-4 text-xs text-zinc-600">
											<span class="flex items-center gap-1">
												<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
													/>
												</svg>
												{formatDateTime(event)}
											</span>
											<span class="text-xs text-zinc-500">Past</span>
										</div>
										{#if event.eventData.description}
											<p class="line-clamp-2 border-zinc-600 text-xs">
												{event.eventData.description}
											</p>
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
