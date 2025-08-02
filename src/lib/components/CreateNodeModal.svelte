<script lang="ts">
	import { nodeTemplates } from '../templates';
	import { 
		FolderOpen, 
		GitBranch, 
		FileText, 
		Code, 
		Calendar, 
		StickyNote, 
		HardDrive, 
		Square 
	} from '@lucide/svelte';

	let { position, onCreate, onClose } = $props<{
		position: { x: number; y: number };
		onCreate: (templateType: string) => void;
		onClose: () => void;
	}>();

	let isCreating = $state(false);

	function handleCreateNode(templateType: string) {
		// Prevent double-clicks
		if (isCreating) return;
		isCreating = true;
		
		onCreate(templateType);
		
		// Reset after a short delay to allow for normal modal closure
		setTimeout(() => {
			isCreating = false;
		}, 100);
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

	function getIconComponent(templateId: string) {
		switch (templateId) {
			case 'project':
				return FolderOpen;
			case 'subproject':
				return GitBranch;
			case 'paper':
				return FileText;
			case 'code':
				return Code;
			case 'time':
				return Calendar;
			case 'note':
				return StickyNote;
			case 'storage':
				return HardDrive;
			case 'blank':
				return Square;
			default:
				return Square;
		}
	}
</script>

<svelte:window on:keydown={handleKeyDown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
	onclick={handleBackdropClick}
>
	<div class="w-96 rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
		<h2 class="mb-4 text-lg font-semibold text-zinc-100">Create New Node</h2>

		<div class="grid grid-cols-2 gap-3">
			{#each Object.values(nodeTemplates).filter(template => template.id !== 'project') as template}
				{@const IconComponent = getIconComponent(template.id)}
				<button
					onclick={() => handleCreateNode(template.id)}
					disabled={isCreating}
					class="focus:ring-opacity-50 flex items-center space-x-3 rounded-lg border border-zinc-700 p-4 text-left transition-all hover:border-zinc-500 hover:bg-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<IconComponent class="h-5 w-5 flex-shrink-0 text-zinc-400" />
					<span class="font-medium text-zinc-200">{template.name}</span>
				</button>
			{/each}
		</div>

		<div class="mt-6 flex items-center justify-between">
			<div class="text-xs text-zinc-400">
				Press <kbd class="rounded bg-zinc-800 px-2 py-1">Escape</kbd> to cancel
			</div>
			<button
				onclick={onClose}
				class="rounded bg-zinc-700 px-4 py-2 text-zinc-300 transition-colors hover:bg-zinc-600"
			>
				Cancel
			</button>
		</div>
	</div>
</div>
