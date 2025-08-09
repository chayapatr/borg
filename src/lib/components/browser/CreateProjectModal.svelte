<script lang="ts">
	let { onCreate, onClose } = $props<{
		onCreate: (data: { title: string }) => void;
		onClose: () => void;
	}>();

	let title = $state('');

	function handleSubmit(event: Event) {
		event.preventDefault();

		if (!title.trim()) return;

		onCreate({
			title: title.trim()
		});
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
	<div class="w-full max-w-md rounded-lg border border-zinc-700 bg-borg-beige p-6 shadow-xl">
		<h2 class="mb-4 text-lg font-semibold text-black">Create New Project</h2>

		<form onsubmit={handleSubmit} class="space-y-4">
			<div>
				<label for="title" class="mb-1 block text-sm font-medium text-zinc-700">
					Project Name
				</label>
				<input
					id="title"
					bind:value={title}
					type="text"
					placeholder="Enter project name"
					required
					class="w-full rounded border border-zinc-700 bg-white px-3 py-2 text-black placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
					autofocus
				/>
			</div>

			<div class="flex gap-3 pt-4">
				<button
					type="button"
					onclick={onClose}
					class="flex-1 rounded bg-borg-brown px-4 py-2 text-zinc-700 transition-colors hover:bg-borg-brown/80"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={!title.trim()}
					class="flex-1 rounded bg-borg-violet px-4 py-2 text-white transition-colors hover:bg-borg-blue disabled:cursor-not-allowed disabled:opacity-50"
				>
					Create Project
				</button>
			</div>
		</form>
	</div>
</div>
