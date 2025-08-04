<script lang="ts">
	import type { TemplateField } from '../templates';
	import { ServiceFactory } from '../services/ServiceFactory';
	import { HardDrive, Link, Archive, Globe } from '@lucide/svelte';

	let {
		field,
		value = $bindable(),
		readonly = false,
		mode = 'display',
		nodeData = undefined,
		countdownOnly = false,
		isProjectTitle = false
	} = $props<{
		field: TemplateField;
		value: any;
		readonly?: boolean;
		mode?: 'display' | 'edit';
		nodeData?: any;
		countdownOnly?: boolean;
		isProjectTitle?: boolean;
	}>();

	// Services for synced data
	const peopleService = ServiceFactory.createPeopleService();
	const timelineService = ServiceFactory.createTimelineService();

	let showTagInput = $state(false);
	let editingButton = $state(false);

	// State for people data
	let allPeople = $state<any[]>([]);
	let peopleMap = $state<Map<string, any>>(new Map());

	// State for timeline data
	let allEvents = $state<any[]>([]);
	let eventsMap = $state<Map<string, any>>(new Map());

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

	// Format countdown display
	function formatCountdown(countdown: {
		days: number;
		hours: number;
		minutes: number;
		isOverdue: boolean;
	}): string {
		if (countdown.isOverdue) return 'Overdue';

		if (countdown.days > 0) {
			return `${countdown.days}D ${countdown.hours}H ${countdown.minutes}M`;
		} else if (countdown.hours > 0) {
			return `${countdown.hours}H ${countdown.minutes}M`;
		} else {
			return `${countdown.minutes}M`;
		}
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

	// Load people data reactively
	$effect(() => {
		(async () => {
			const result = peopleService.getAllPeople();
			const people = result instanceof Promise ? await result : result;
			allPeople = people;

			// Create a map for quick lookup
			const map = new Map();
			people.forEach((person) => map.set(person.id, person));
			peopleMap = map;
		})();
	});

	// Load timeline data reactively
	$effect(() => {
		(async () => {
			if (timelineService.getEventsSortedByDate) {
				const result = timelineService.getEventsSortedByDate();
				const events = result instanceof Promise ? await result : result;
				allEvents = events;

				// Create a map for quick lookup
				const map = new Map();
				events.forEach((event) => map.set(event.id, event));
				eventsMap = map;
			}
		})();
	});

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

	// Function to get the appropriate icon for a field
	function getFieldIcon(fieldLabel: string): {
		type: 'svg' | 'lucide';
		path?: string;
		component?: any;
	} {
		const label = fieldLabel.toLowerCase();

		// Check for static SVG logos first
		if (label.includes('github')) {
			return { type: 'svg', path: '/github.svg' };
		}
		if (label.includes('google drive') || label.includes('drive')) {
			return { type: 'svg', path: '/googledrive.svg' };
		}
		if (label.includes('overleaf')) {
			return { type: 'svg', path: '/overleaf.svg' };
		}

		// Fall back to Lucide icons
		if (label.includes('arxiv') || label.includes('archive')) {
			return { type: 'lucide', component: Archive };
		}
		if (label.includes('publisher') || label.includes('website')) {
			return { type: 'lucide', component: Globe };
		}
		if (label.includes('dropbox') || label.includes('storage')) {
			return { type: 'lucide', component: HardDrive };
		}

		// Default to Link icon
		return { type: 'lucide', component: Link };
	}
</script>

<div class="field-container">
	{#if !((field.type === 'button' || field.type === 'link' || field.id === 'title' || countdownOnly) && mode === 'display')}
		<label class="mb-1 block text-sm font-medium text-zinc-600">
			{field.label}
		</label>
	{/if}

	{#if field.type === 'text'}
		{#if readonly || mode === 'display'}
			<div
				class="py-1 font-semibold text-black {isProjectTitle
					? 'text-2xl'
					: field.id === 'title'
						? 'font-sanss text-lg'
						: ''}"
			>
				{value || '-'}
			</div>
		{:else}
			<input
				type="text"
				bind:value
				placeholder={field.placeholder}
				class="w-full rounded border border-black bg-white px-3 py-2 text-black placeholder-zinc-400 focus:border-borg-blue focus:outline-none"
			/>
		{/if}
	{:else if field.type === 'textarea'}
		{#if readonly || mode === 'display'}
			<div class="py-1 whitespace-pre-wrap text-black">
				{value || '-'}
			</div>
		{:else}
			<textarea
				bind:value
				placeholder={field.placeholder}
				rows="3"
				class="w-full resize-none rounded border border-zinc-700 bg-white px-3 py-2 text-black placeholder-zinc-400 focus:border-borg-blue focus:outline-none"
			></textarea>
		{/if}
	{:else if field.type === 'tags'}
		<div class="space-y-2">
			<div class="flex flex-wrap gap-1">
				{#if value && Array.isArray(value) && value.length > 0}
					{#each value as tag}
						<span
							class="inline-flex items-center gap-1 rounded-full bg-black px-2 py-1 text-xs text-white"
						>
							{tag}
							{#if !readonly}
								<button onclick={() => removeTag(tag)} class="hover:text-red-300"> × </button>
							{/if}
						</span>
					{/each}
				{/if}

				{#if !readonly && mode === 'edit'}
					<div class="relative">
						<button
							type="button"
							onclick={() => (showTagInput = !showTagInput)}
							class="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-white px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-700"
						>
							<span>+</span>
						</button>

						{#if showTagInput}
							<input
								type="text"
								placeholder={field.placeholder}
								onkeydown={handleTagsInput}
								onblur={() => (showTagInput = false)}
								class="absolute top-0 left-0 z-10 w-32 rounded border border-zinc-700 bg-white px-2 py-1 text-xs text-black placeholder-zinc-400 focus:border-borg-blue focus:outline-none"
								autofocus
							/>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{:else if field.type === 'status'}
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
	{:else if field.type === 'link'}
		{#if mode === 'display'}
			{#if value}
				{@const icon = getFieldIcon(field.label)}
				<button
					onclick={() => window.open(value, '_blank')}
					class="flex w-full items-center justify-center gap-1 rounded-lg bg-black p-2 text-xs font-medium text-white transition-colors hover:bg-borg-violet focus:ring-2 focus:ring-borg-blue focus:ring-offset-2 focus:ring-offset-zinc-900 focus:outline-none"
				>
					{#if icon.type === 'svg'}
						<img src={icon.path} alt="" class="h-4 w-4" />
					{:else if icon.component}
						{@const IconComponent = icon.component}
						<IconComponent class="h-4 w-4" />
					{/if}
					Open {field.label}
				</button>
			{:else}
				<div class="py-1 text-zinc-600">No link set</div>
			{/if}
		{:else if readonly}
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
				<div class="py-1 text-black">-</div>
			{/if}
		{:else}
			<input
				type="url"
				bind:value
				placeholder={field.placeholder}
				class="w-full rounded border border-zinc-700 bg-white px-3 py-2 text-black placeholder-zinc-400 focus:border-borg-blue focus:outline-none"
			/>
		{/if}
	{:else if field.type === 'date'}
		{#if readonly || mode === 'display'}
			<div class="py-1 text-black">
				{#if value}
					{@const targetDate = new Date(value)}
					{@const now = new Date()}
					{#if targetDate > now}
						{@const timeDiff = targetDate.getTime() - now.getTime()}
						{@const days = Math.ceil(timeDiff / (1000 * 60 * 60 * 24))}
						<div class="space-y-1">
							<div class="font-medium text-yellow-400">
								{days} day{days !== 1 ? 's' : ''} remaining
							</div>
							<div class="text-sm text-zinc-600">
								{targetDate.toLocaleDateString()}
							</div>
						</div>
					{:else}
						{targetDate.toLocaleDateString()}
					{/if}
				{:else}
					-
				{/if}
			</div>
		{:else}
			<input
				type="date"
				bind:value
				class="w-full rounded border border-zinc-700 bg-white px-3 py-2 text-black focus:border-borg-blue focus:outline-none"
			/>
		{/if}
	{:else if field.type === 'button'}
		{#if mode === 'display'}
			{#if value}
				{@const icon = getFieldIcon(field.label)}
				<button
					onclick={() => window.open(value, '_blank')}
					class="flex w-full items-center justify-center gap-1 rounded-lg bg-black px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-borg-violet focus:ring-2 focus:ring-borg-blue focus:ring-offset-2 focus:ring-offset-zinc-900 focus:outline-none"
				>
					{#if icon.type === 'svg'}
						<img src={icon.path} alt="" class="h-4 w-4" />
					{:else if icon.component}
						{@const IconComponent = icon.component}
						<IconComponent class="h-4 w-4" />
					{/if}
					Open {field.label}
				</button>
			{:else}
				<div class="py-1 text-zinc-600">No URL set</div>
			{/if}
		{:else if readonly}
			{#if value}
				{@const icon = getFieldIcon(field.label)}
				<button
					onclick={() => window.open(value, '_blank')}
					class="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-600 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-500 focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:outline-none"
				>
					{#if icon.type === 'svg'}
						<img src={icon.path} alt="" class="h-4 w-4" />
					{:else if icon.component}
						{@const IconComponent = icon.component}
						<IconComponent class="h-4 w-4" />
					{/if}
					Open {field.label}
				</button>
			{:else}
				<div class="py-1 text-black">-</div>
			{/if}
		{:else}
			<input
				type="url"
				bind:value
				placeholder="Enter URL..."
				class="w-full rounded border border-black bg-white px-3 py-2 text-black placeholder-zinc-400 focus:border-borg-blue focus:outline-none"
			/>
		{/if}
	{:else if field.type === 'people-selector'}
		<div class="space-y-2">
			<div class="flex flex-wrap gap-1">
				{#if value && Array.isArray(value) && value.length > 0}
					{#each value as personId}
						{@const person = peopleMap.get(personId)}
						{#if person}
							<span
								class="inline-flex items-center gap-1 rounded-full bg-borg-blue px-2 py-1 text-xs text-white"
							>
								{person.name}
								{#if mode === 'edit'}
									<button
										onclick={() => {
											value = value.filter((id) => id !== personId);
										}}
										class="hover:text-red-300"
									>
										×
									</button>
								{/if}
							</span>
						{/if}
					{/each}
				{/if}

				{#if mode === 'edit'}
					{@const availablePeople = allPeople.filter((p) => !value?.includes(p.id))}
					{#if availablePeople.length > 0}
						<select
							value=""
							onchange={(e) => {
								const target = e.target as HTMLSelectElement;
								const selectedId = target.value;
								if (selectedId) {
									value = value ? [...value, selectedId] : [selectedId];
									target.value = '';
								}
							}}
							class="rounded border border-zinc-700 bg-white px-2 py-1 text-xs text-black focus:border-borg-blue focus:outline-none"
						>
							<option value="">Add person...</option>
							{#each availablePeople as person}
								<option value={person.id}>{person.name}</option>
							{/each}
						</select>
					{/if}
				{/if}
			</div>
		</div>
	{:else if field.type === 'timeline-selector'}
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
			<select
				bind:value
				class="w-full rounded border border-zinc-700 bg-white px-3 py-2 text-black focus:border-borg-blue focus:outline-none"
			>
				<option value="">Select timeline event...</option>
				{#each allEvents as event}
					<option value={event.id}>
						{event.title} ({new Date(event.date).toLocaleDateString()}) - {event.templateType ||
							'Event'}
					</option>
				{/each}
			</select>
		{/if}
	{:else if field.type === 'color-picker'}
		{#if mode === 'display'}
			{#if value}
				<div class="py-1">
					<div class="flex items-center space-x-2">
						<div
							class="h-4 w-4 rounded border border-gray-300"
							style="background-color: {value}"
						></div>
						<span class="text-sm text-zinc-600">{value}</span>
					</div>
				</div>
			{:else}
				<div class="py-1 text-zinc-600">No color selected</div>
			{/if}
		{:else}
			<div class="space-y-2">
				<input
					type="color"
					bind:value
					class="h-10 w-full cursor-pointer rounded border border-zinc-700"
					{readonly}
				/>
				<div class="grid grid-cols-6 gap-2">
					{#each ['#fef08a', '#fde047', '#facc15', '#fed7d7', '#fbb6ce', '#ddd6fe', '#a5f3fc', '#bbf7d0', '#fed7aa', '#fecaca'] as color}
						<button
							type="button"
							class="h-8 w-8 rounded border-2 border-gray-300 transition-colors hover:border-gray-400"
							style="background-color: {color}"
							onclick={() => {
								value = color;
							}}
						></button>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
