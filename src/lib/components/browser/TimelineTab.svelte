<script lang="ts">
	import { onMount } from 'svelte';
	import { ServiceFactory } from '../../services/ServiceFactory';
	import type { ITimelineService } from '../../services/interfaces/ITimelineService';
	import type { TimelineEvent } from '../../services/local/TimelineService';
	import AddTimelineEventModal from './AddTimelineEventModal.svelte';

	let timelineService: ITimelineService;
	let events = $state<TimelineEvent[]>([]);
	let showAddModal = $state(false);

	onMount(() => {
		timelineService = ServiceFactory.createTimelineService();
		loadEvents();
	});

	async function loadEvents() {
		const result = timelineService.getEventsSortedByDate();
		events = result instanceof Promise ? await result : result;
	}

	async function handleAddEvent(templateType: string, eventData: Record<string, any>) {
		const result = timelineService.addEvent(templateType, eventData);
		if (result instanceof Promise) await result;
		await loadEvents();
		showAddModal = false;
	}

	async function handleDeleteEvent(id: string) {
		if (confirm('Are you sure you want to delete this event?')) {
			const result = timelineService.deleteEvent(id);
			if (result instanceof Promise) await result;
			await loadEvents();
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

<div class="flex-1 flex flex-col">
	<!-- Header -->
	<div class="p-6 border-b border-zinc-800">
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
	</div>

	<!-- Timeline Events -->
	<div class="flex-1 p-6 overflow-y-auto">
		{#if events.length === 0}
			<div class="flex flex-col items-center justify-center h-64 text-center">
				<div class="w-16 h-16 bg-zinc-800 rounded-lg flex items-center justify-center mb-4">
					<svg class="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
					</svg>
				</div>
				<h3 class="text-lg font-medium text-zinc-300 mb-2">No events yet</h3>
				<p class="text-zinc-500 mb-4">Add your first conference, deadline, or event</p>
				<button
					onclick={() => (showAddModal = true)}
					class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
				>
					Add Event
				</button>
			</div>
		{:else}
			<div class="space-y-4">
				{#each events as event}
					{@const template = getTemplateInfo(event.templateType)}
					<div class="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors">
						<div class="flex items-start justify-between">
							<div class="flex items-start gap-3 flex-1">
								<div 
									class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
									style="background-color: {template.color}20; border: 1px solid {template.color}40;"
								>
									<svg class="w-5 h-5" style="color: {template.color}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
								<div class="flex-1">
									<div class="flex items-center gap-2 mb-1">
										<h3 class="font-medium text-zinc-100">{event.title}</h3>
										<span class="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-300">
											{template.name}
										</span>
									</div>
									<div class="flex items-center gap-4 text-sm text-zinc-400 mb-2">
										<span class="flex items-center gap-1">
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
											</svg>
											{formatDate(event.date)}
										</span>
										{#if isUpcoming(event.date)}
											<span class="text-green-400 text-xs">Upcoming</span>
										{:else}
											<span class="text-zinc-500 text-xs">Past</span>
										{/if}
									</div>
									{#if event.eventData.description}
										<p class="text-sm text-zinc-400 line-clamp-2">{event.eventData.description}</p>
									{/if}
								</div>
							</div>
							<button
								onclick={() => handleDeleteEvent(event.id)}
								class="text-zinc-500 hover:text-red-400 transition-colors ml-2"
								aria-label="Delete event"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
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
		onClose={() => (showAddModal = false)}
	/>
{/if}