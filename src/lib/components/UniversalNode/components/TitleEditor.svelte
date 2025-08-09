<script lang="ts">
	let {
		nodeData,
		isEditingTitle = $bindable(),
		onSave,
		isProjectNode = false
	} = $props<{
		nodeData: any;
		isEditingTitle: boolean;
		onSave: (title: string) => void;
		isProjectNode?: boolean;
	}>();

	let titleContent = $state('');
	let titleInput = $state<HTMLInputElement>();

	function startTitleEdit() {
		if (isProjectNode) return; // Don't allow editing project titles
		
		isEditingTitle = true;
		titleContent = nodeData.title || '';

		// Focus the input after it's rendered
		setTimeout(() => {
			if (titleInput) {
				titleInput.focus();
				titleInput.select();
			}
		}, 0);
	}

	function saveTitleContent() {
		onSave(titleContent);
		isEditingTitle = false;
	}

	function handleTitleBlur() {
		saveTitleContent();
	}

	function handleTitleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			saveTitleContent();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			titleContent = nodeData.title || '';
			isEditingTitle = false;
		}
	}

	function handleTitleClick(event: MouseEvent) {
		if (isProjectNode) return;
		event.stopPropagation();
		startTitleEdit();
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if isEditingTitle}
	<input
		bind:this={titleInput}
		bind:value={titleContent}
		onblur={handleTitleBlur}
		onkeydown={handleTitleKeydown}
		class="w-full rounded-lg border border-black bg-white px-3 py-2 text-black focus:ring-2 focus:ring-borg-blue focus:outline-none {isProjectNode
			? 'text-xl font-semibold'
			: 'text-base'}"
		placeholder="Enter title..."
	/>
{:else}
	<div
		onclick={handleTitleClick}
		class="{isProjectNode ? '' : 'cursor-text'} py-1 font-semibold text-black {isProjectNode
			? '-mt-2 text-3xl'
			: 'font-sans text-lg text-balance'}"
	>
		{nodeData.title || 'Untitled'}
	</div>
{/if}