<script lang="ts">
	import {
		GitBranch,
		FileText,
		Code,
		Calendar,
		StickyNote,
		Link,
		Square,
		Sticker,
		FolderPlus,
		Image,
		Monitor,
		BookOpen
	} from '@lucide/svelte';
	import { nodeTemplates } from '../templates';

	let {
		view = 'projects',
		onCreateNode,
		onShowStickers,
		onCreateProject
	} = $props<{
		onCreateNode: (templateType: string) => void;
		onShowStickers?: () => void;
		onCreateProject?: () => void;
		view: 'projects' | 'project';
	}>();

	const projectsToolbarItems = [
		{ id: 'note', icon: StickyNote, template: nodeTemplates.note },
		{ id: 'image', icon: Image, template: nodeTemplates.image },
		{ id: 'iframe', icon: Monitor, template: nodeTemplates.iframe }
	];

	const projectToolbarItems = [
		{ id: 'subproject', icon: GitBranch, template: nodeTemplates.subproject },
		{ id: 'paper', icon: FileText, template: nodeTemplates.paper },
		{ id: 'code', icon: Code, template: nodeTemplates.code },
		{ id: 'time', icon: Calendar, template: nodeTemplates.time },
		{ id: 'note', icon: StickyNote, template: nodeTemplates.note },
		{ id: 'image', icon: Image, template: nodeTemplates.image },
		{ id: 'iframe', icon: Monitor, template: nodeTemplates.iframe },
		{ id: 'wiki', icon: BookOpen, template: nodeTemplates.wiki },
		{ id: 'link', icon: Link, template: nodeTemplates.link },
		{ id: 'blank', icon: Square, template: nodeTemplates.blank }
	];

	// Special items (not templates)
	const specialItems = [
		{ id: 'stickers', icon: Sticker, name: 'Stickers', action: 'showStickers' }
	];

	// Special items for projects view only
	const projectsSpecialItems = [
		{ id: 'newProject', icon: FolderPlus, name: 'New Project', action: 'createProject' }
	];

	function handleItemClick(templateType: string) {
		onCreateNode(templateType);
	}

	function handleSpecialItemClick(action: string) {
		console.log('🎨 Toolbar handleSpecialItemClick called with action:', action);
		if (action === 'showStickers' && onShowStickers) {
			console.log('🎨 Calling onShowStickers...');
			onShowStickers();
		} else if (action === 'createProject' && onCreateProject) {
			console.log('📁 Calling onCreateProject...');
			onCreateProject();
		}
	}

	// Track if the toolbar is being hovered
	let isToolbarHovered = $state(false);
</script>

<div class="absolute top-1/2 left-4 z-20 -translate-y-1/2">
	<div
		class="flex flex-col rounded-lg border border-black bg-borg-brown p-2 shadow-lg"
		onmouseenter={() => (isToolbarHovered = true)}
		onmouseleave={() => (isToolbarHovered = false)}
		role="toolbar"
		tabindex="0"
		aria-label="Node creation toolbar"
	>
		<!-- New Project button - only show in projects view -->
		{#if view === 'projects'}
			{#each projectsSpecialItems as item}
				<button
					onclick={() => handleSpecialItemClick(item.action)}
					class="group flex h-10 items-center rounded-md transition-all duration-300 ease-in-out hover:bg-white {isToolbarHovered
						? 'w-auto justify-start gap-2 pr-3 pl-2'
						: 'w-10 justify-center'}"
					aria-label={item.name}
				>
					<item.icon class="h-5 w-5 flex-shrink-0 text-gray-700 group-hover:text-gray-900" />
					<span
						class="text-sm whitespace-nowrap text-gray-700 transition-all duration-300 ease-in-out group-hover:text-gray-900 {isToolbarHovered
							? 'max-w-none opacity-100'
							: 'max-w-0 overflow-hidden opacity-0'}"
					>
						{item.name}
					</span>
				</button>
			{/each}
			<div class="my-1 w-full border-t border-gray-300"></div>
		{/if}

		{#each view === 'projects' ? projectsToolbarItems : projectToolbarItems as item}
			<button
				onclick={() => handleItemClick(item.id)}
				class="group flex h-10 items-center rounded-md transition-all duration-300 ease-in-out hover:bg-white {isToolbarHovered
					? 'w-auto justify-start gap-2 pr-3 pl-2'
					: 'w-10 justify-center'}"
				aria-label="Create {item.template.name} node"
			>
				<item.icon class="h-5 w-5 flex-shrink-0 text-gray-700 group-hover:text-gray-900" />
				<span
					class="text-sm whitespace-nowrap text-gray-700 transition-all duration-300 ease-in-out group-hover:text-gray-900 {isToolbarHovered
						? 'max-w-none opacity-100'
						: 'max-w-0 overflow-hidden opacity-0'}"
				>
					{item.template.name}
				</span>
			</button>
		{/each}

		<!-- Special items (like stickers) - show in both project and projects view -->
		<div class="w-full border-t border-gray-300"></div>
		{#each specialItems as item}
			<button
				onclick={() => handleSpecialItemClick(item.action)}
				class="group flex h-10 items-center rounded-md transition-all duration-300 ease-in-out hover:bg-white {isToolbarHovered
					? 'w-auto justify-start gap-2 pr-3 pl-2'
					: 'w-10 justify-center'}"
				aria-label={item.name}
			>
				<item.icon class="h-5 w-5 flex-shrink-0 text-gray-700 group-hover:text-gray-900" />
				<span
					class="text-sm whitespace-nowrap text-gray-700 transition-all duration-300 ease-in-out group-hover:text-gray-900 {isToolbarHovered
						? 'max-w-none opacity-100'
						: 'max-w-0 overflow-hidden opacity-0'}"
				>
					{item.name}
				</span>
			</button>
		{/each}
	</div>
</div>
