<script lang="ts">
	import {
		GitBranch,
		FileText,
		Code,
		Calendar,
		StickyNote,
		HardDrive,
		Square
	} from '@lucide/svelte';
	import { nodeTemplates } from '../templates';

	let { view = 'projects', onCreateNode } = $props<{
		onCreateNode: (templateType: string) => void;
		view: 'projects' | 'project';
	}>();

	const projectsToolbarItems = [{ id: 'note', icon: StickyNote, template: nodeTemplates.note }];

	const projectToolbarItems = [
		{ id: 'subproject', icon: GitBranch, template: nodeTemplates.subproject },
		{ id: 'paper', icon: FileText, template: nodeTemplates.paper },
		{ id: 'code', icon: Code, template: nodeTemplates.code },
		{ id: 'time', icon: Calendar, template: nodeTemplates.time },
		{ id: 'note', icon: StickyNote, template: nodeTemplates.note },
		{ id: 'storage', icon: HardDrive, template: nodeTemplates.storage },
		{ id: 'blank', icon: Square, template: nodeTemplates.blank }
	];

	function handleItemClick(templateType: string) {
		onCreateNode(templateType);
	}

	// Track if the toolbar is being hovered
	let isToolbarHovered = $state(false);
</script>

<div class="absolute top-1/2 left-4 z-20 -translate-y-1/2">
	<div 
		class="flex flex-col rounded-lg border border-black bg-borg-brown p-2 shadow-lg"
		onmouseenter={() => isToolbarHovered = true}
		onmouseleave={() => isToolbarHovered = false}
		role="toolbar"
		tabindex="0"
		aria-label="Node creation toolbar"
	>
		{#each view === 'projects' ? projectsToolbarItems : projectToolbarItems as item}
			<button
				onclick={() => handleItemClick(item.id)}
				class="group flex h-10 items-center rounded-md hover:bg-white transition-all duration-300 ease-in-out {isToolbarHovered ? 'w-auto pl-2 pr-3 justify-start gap-2' : 'w-10 justify-center'}"
				aria-label="Create {item.template.name} node"
			>
				<item.icon class="h-5 w-5 text-gray-700 group-hover:text-gray-900 flex-shrink-0" />
				<span class="text-sm text-gray-700 group-hover:text-gray-900 whitespace-nowrap transition-all duration-300 ease-in-out {isToolbarHovered ? 'opacity-100 max-w-none' : 'opacity-0 max-w-0 overflow-hidden'}">
					{item.template.name}
				</span>
			</button>
		{/each}
	</div>
</div>
