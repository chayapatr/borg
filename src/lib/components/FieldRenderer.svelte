<script lang="ts">
	import type { TemplateField } from '../templates';
	import { ServiceFactory } from '../services/ServiceFactory';

	let {
		field,
		value = $bindable(),
		readonly = false,
		mode = 'display'
	} = $props<{
		field: TemplateField;
		value: any;
		readonly?: boolean;
		mode?: 'display' | 'edit';
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

	// Load people data reactively
	$effect(() => {
		(async () => {
			const result = peopleService.getAllPeople();
			const people = result instanceof Promise ? await result : result;
			allPeople = people;
			
			// Create a map for quick lookup
			const map = new Map();
			people.forEach(person => map.set(person.id, person));
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
				events.forEach(event => map.set(event.id, event));
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
			'To Do': 'bg-purple-500/20 text-purple-400',
			Doing: 'bg-blue-500/20 text-blue-400',
			Done: 'bg-green-500/20 text-green-400',

			// Publication statuses for papers
			Draft: 'bg-gray-500/20 text-gray-400',
			'In Review': 'bg-yellow-500/20 text-yellow-400',
			Accepted: 'bg-green-500/20 text-green-400',
			Published: 'bg-blue-500/20 text-blue-400'
		};

		return statusColors[status] || 'bg-zinc-500/20 text-zinc-600';
	}
</script>

<div class="field-container">
	<label class="mb-1 block text-sm font-medium text-zinc-600">
		{field.label}
	</label>

	{#if field.type === 'text'}
		{#if readonly || mode === 'display'}
			<div class="py-1 text-black">
				{value || '-'}
			</div>
		{:else}
			<input
				type="text"
				bind:value
				placeholder={field.placeholder}
				class="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-black placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
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
				class="w-full resize-none rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-black placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
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

				{#if !readonly && mode === 'edit'}
					<div class="relative">
						<button
							type="button"
							onclick={() => (showTagInput = !showTagInput)}
							class="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-700"
						>
							<span>+</span>
						</button>

						{#if showTagInput}
							<input
								type="text"
								placeholder={field.placeholder}
								onkeydown={handleTagsInput}
								onblur={() => (showTagInput = false)}
								class="absolute top-0 left-0 z-10 w-32 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-black placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
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
							class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors {value ===
							option
								? getStatusColor(option)
								: 'bg-zinc-700 text-zinc-600 hover:bg-zinc-600'}"
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
				<button
					onclick={() => window.open(value, '_blank')}
					class="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:outline-none"
				>
					{field.buttonText || 'Open Link'}
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
				class="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-black placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
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
				class="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-black focus:border-blue-500 focus:outline-none"
			/>
		{/if}
	{:else if field.type === 'button'}
		{#if mode === 'display'}
			{#if value}
				<button
					onclick={() => window.open(value, '_blank')}
					class="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:outline-none"
				>
					{field.buttonText || 'Open'}
				</button>
			{:else}
				<div class="py-1 text-zinc-600">No URL set</div>
			{/if}
		{:else if readonly}
			{#if value}
				<button
					onclick={() => window.open(value, '_blank')}
					class="w-full rounded-lg bg-zinc-600 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-500 focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:outline-none"
				>
					{field.buttonText || 'Open'}
				</button>
			{:else}
				<div class="py-1 text-black">-</div>
			{/if}
		{:else}
			<input
				type="url"
				bind:value
				placeholder="Enter URL..."
				class="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-black placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
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
								class="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-1 text-xs text-white"
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
							class="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-black focus:border-blue-500 focus:outline-none"
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
					<div class="py-1 text-black">
						<div class="font-medium">{event.title}</div>
						<div class="text-sm text-zinc-600">
							{new Date(event.date).toLocaleDateString()} • {event.templateType || 'Event'}
						</div>
					</div>
				{:else}
					<div class="py-1 text-zinc-600">Event not found</div>
				{/if}
			{:else}
				<div class="py-1 text-zinc-600">No event selected</div>
			{/if}
		{:else}
			<select
				bind:value
				class="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-black focus:border-blue-500 focus:outline-none"
			>
				<option value="">Select timeline event...</option>
				{#each allEvents as event}
					<option value={event.id}>
						{event.title} ({new Date(event.date).toLocaleDateString()}) - {event.templateType || 'Event'}
					</option>
				{/each}
			</select>
		{/if}
	{/if}
</div>
