<script lang="ts">
	let {
		onAdd,
		onClose
	} = $props<{
		onAdd: (data: { name: string; email?: string }) => void;
		onClose: () => void;
	}>();

	let name = $state('');
	let email = $state('');

	function handleSubmit() {
		if (!name.trim()) return;
		
		onAdd({
			name: name.trim(),
			email: email.trim() || undefined
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
	<div class="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
		<h2 class="mb-4 text-lg font-semibold text-zinc-100">Add Person</h2>

		<div class="space-y-4">
			<div>
				<label for="name" class="mb-1 block text-sm font-medium text-zinc-300">
					Name
				</label>
				<input
					id="name"
					bind:value={name}
					type="text"
					placeholder="Enter full name"
					required
					class="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
					autofocus
				/>
			</div>

			<div>
				<label for="email" class="mb-1 block text-sm font-medium text-zinc-300">
					Email (optional)
				</label>
				<input
					id="email"
					bind:value={email}
					type="email"
					placeholder="person@example.com"
					class="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
				/>
			</div>

			<div class="flex gap-3 pt-4">
				<button
					type="button"
					onclick={onClose}
					class="flex-1 rounded bg-zinc-700 px-4 py-2 text-zinc-300 transition-colors hover:bg-zinc-600"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={handleSubmit}
					disabled={!name.trim()}
					class="flex-1 rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Add Person
				</button>
			</div>
		</div>
	</div>
</div>