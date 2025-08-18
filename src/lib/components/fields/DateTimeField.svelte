<script lang="ts">
	import type { TemplateField } from '../../templates';

	let {
		field,
		value = $bindable(),
		readonly = false,
		mode = 'display'
	} = $props<{
		field: TemplateField;
		value: string;
		readonly?: boolean;
		mode?: 'display' | 'edit';
	}>();

	// Internal state for the form inputs
	let dateValue = $state('');
	let timeValue = $state('00:00');
	let timezoneValue = $state('-5');

	// Initialize from existing value or set defaults
	$effect(() => {
		console.log('DateTimeField effect - value:', value);
		if (value && value.includes('T')) {
			// Parse existing timestamp
			console.log('Parsing timestamp:', value);
			
			// Extract date part (YYYY-MM-DD)
			const datePart = value.split('T')[0];
			dateValue = datePart;
			console.log('Extracted date:', dateValue);
			
			// Extract time part (HH:MM) - handle both with and without seconds
			const timePart = value.split('T')[1];
			if (timePart) {
				// Remove timezone offset and seconds if present
				const timeOnly = timePart.split(/[+-]/)[0]; // Split on + or -
				const timeComponents = timeOnly.split(':');
				timeValue = `${timeComponents[0]}:${timeComponents[1]}`; // Only take HH:MM
				console.log('Extracted time:', timeValue);
				
				// Extract timezone from the ISO string (e.g., "-05:00" -> "-5")
				const timezoneMatch = value.match(/([+-]\d{1,2}):\d{2}$/);
				if (timezoneMatch) {
					timezoneValue = String(parseInt(timezoneMatch[1]));
				} else {
					timezoneValue = '-5'; // Default to ET
				}
				console.log('Extracted timezone:', timezoneValue);
			} else {
				timeValue = '00:00';
				timezoneValue = '-5';
			}
		} else if (!dateValue) {
			// Only set defaults if not already set
			console.log('Setting defaults');
			const today = new Date();
			dateValue = today.toISOString().split('T')[0];
			timeValue = '00:00';
			timezoneValue = field.defaultValue || '-5';
			updateTimestamp();
		}
	});

	// Update the timestamp whenever date, time, or timezone changes
	function updateTimestamp() {
		if (dateValue && timeValue && timezoneValue) {
			// Create ISO timestamp with timezone offset (no seconds)
			const offset = parseInt(timezoneValue);
			const offsetString = offset >= 0 ? 
				`+${Math.abs(offset).toString().padStart(2, '0')}:00` : 
				`-${Math.abs(offset).toString().padStart(2, '0')}:00`;
			value = `${dateValue}T${timeValue}${offsetString}`;
		}
	}

	// Time options for quick selection
	const timeOptions = [
		'00:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'
	];

	let showTimeOptions = $state(false);

	function selectTime(time: string) {
		timeValue = time;
		updateTimestamp();
		showTimeOptions = false;
	}

	// Format timestamp for display
	function formatTimestamp(timestamp: string): string {
		if (!timestamp) return 'No date set';
		try {
			const date = new Date(timestamp);
			const dateStr = date.toLocaleDateString();
			const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
			const offset = timestamp.match(/([+-]\d{1,2}):\d{2}$/)?.[1];
			const timezone = offset === '-5' ? 'ET' : offset === '-12' ? 'AOE' : `UTC${offset}`;
			return `${dateStr} at ${timeStr} ${timezone}`;
		} catch {
			return timestamp;
		}
	}
</script>

<div class="field-container">
	{#if mode === 'edit'}
		<label class="mb-1 block text-sm font-medium text-zinc-600">
			{field.label}
		</label>
		<div class="flex gap-2">
			<!-- Date -->
			<div class="flex-1">
				<input
					type="date"
					value={dateValue}
					oninput={(e) => { dateValue = e.target.value; updateTimestamp(); }}
					disabled={readonly}
					class="w-full rounded border border-black bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-100"
				/>
			</div>
			<!-- Time with dropdown -->
			<div class="relative w-32">
				<input
					type="time"
					value={timeValue}
					oninput={(e) => { timeValue = e.target.value; updateTimestamp(); }}
					onfocus={() => showTimeOptions = true}
					onblur={() => setTimeout(() => showTimeOptions = false, 150)}
					disabled={readonly}
					class="w-full rounded border border-black bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-100"
				/>
				{#if showTimeOptions && !readonly}
					<div class="absolute top-full left-0 right-0 z-10 mt-1 max-h-40 overflow-y-auto rounded border border-black bg-white shadow-lg">
						{#each timeOptions as time}
							<button
								type="button"
								onclick={() => selectTime(time)}
								class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100"
							>
								{time}
							</button>
						{/each}
					</div>
				{/if}
			</div>
			<!-- Timezone -->
			<div class="w-20">
				<select
					value={timezoneValue}
					oninput={(e) => { timezoneValue = e.target.value; updateTimestamp(); }}
					disabled={readonly}
					class="w-full rounded border border-black bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-100"
				>
					<option value="-5">ET</option>
					<option value="-12">AOE</option>
				</select>
			</div>
		</div>
	{:else if value}
		<div class="flex items-center gap-2">
			<span class="text-sm font-medium text-zinc-600">{field.label}:</span>
			<span class="text-sm text-zinc-900">{formatTimestamp(value)}</span>
		</div>
	{/if}
</div>

<style>
	.field-container {
		width: 100%;
	}
</style>