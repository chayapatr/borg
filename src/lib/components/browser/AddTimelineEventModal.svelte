<script lang="ts">
	import { TimelineService, timelineTemplates } from '../../services/local/TimelineService';
	import FieldRenderer from '../FieldRenderer.svelte';

	let {
		onAdd,
		onClose
	} = $props<{
		onAdd: (templateType: string, eventData: Record<string, any>) => void;
		onClose: () => void;
	}>();

	let timelineService = new TimelineService();
	let eventData = $state<Record<string, any>>({
		title: '',
		date: '',
		description: ''
	});

	function handleSubmit(event: Event) {
		event.preventDefault();
		
		if (!eventData.title?.trim()) return;

		onAdd('event', eventData);
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
				<!-- Event Title -->
				<div>
					<label class="mb-2 block text-sm font-medium text-zinc-300">
						Event Title
					</label>
					<input
						type="text"
						bind:value={eventData.title}
						placeholder="Enter event title..."
						class="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
						required
					/>
				</div>

				<!-- Event Date -->
				<div>
					<label class="mb-2 block text-sm font-medium text-zinc-300">
						Date
					</label>
					<input
						type="date"
						bind:value={eventData.date}
						class="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-blue-500 focus:outline-none"
						required
					/>
				</div>

				<!-- Event Description -->
				<div>
					<label class="mb-2 block text-sm font-medium text-zinc-300">
						Description
					</label>
					<textarea
						bind:value={eventData.description}
						placeholder="Enter event description..."
						rows="3"
						class="w-full resize-none rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
					></textarea>
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