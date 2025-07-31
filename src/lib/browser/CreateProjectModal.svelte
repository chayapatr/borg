<script lang="ts">
	let {
		onCreate,
		onClose
	} = $props<{
		onCreate: (data: { title: string; description?: string; status?: string }) => void;
		onClose: () => void;
	}>();

	let title = $state('');
	let description = $state('');
	let status = $state('active');

	function handleSubmit(event: Event) {
		event.preventDefault();
		
		if (!title.trim()) return;

		onCreate({
			title: title.trim(),
			description: description.trim() || undefined,
			status
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
		<h2 class="mb-4 text-lg font-semibold text-zinc-100">Create New Project</h2>

		<form onsubmit={handleSubmit} class="space-y-4">
			<div>
				<label for="title" class="mb-1 block text-sm font-medium text-zinc-300">
					Project Title
				</label>
				<input
					id="title"
					bind:value={title}
					type="text"
					placeholder="Enter project name"
					required
					class="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
					autofocus
				/>
			</div>

			<div>
				<label for="description" class="mb-1 block text-sm font-medium text-zinc-300">
					Description
				</label>
				<textarea
					id="description"
					bind:value={description}
					placeholder="Brief description of the project"
					rows="3"
					class="w-full resize-none rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
				></textarea>
			</div>

			<div>
				<label for="status" class="mb-1 block text-sm font-medium text-zinc-300">
					Status
				</label>
				<select
					id="status"
					bind:value={status}
					class="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-blue-500 focus:outline-none"
				>
					<option value="planning">Planning</option>
					<option value="active">Active</option>
					<option value="archived">Archived</option>
				</select>
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
					type="submit"
					disabled={!title.trim()}
					class="flex-1 rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Create Project
				</button>
			</div>
		</form>
	</div>
</div>