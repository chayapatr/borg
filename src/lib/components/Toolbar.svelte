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

	let { onCreateNode } = $props<{
		onCreateNode: (templateType: string) => void;
	}>();

	const toolbarItems = [
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
</script>

<div class="absolute top-1/2 left-4 z-10 -translate-y-1/2">
	<div class="flex flex-col rounded-lg border border-black bg-borg-brown p-2">
		{#each toolbarItems as item}
			<button
				onclick={() => handleItemClick(item.id)}
				class="group flex h-10 w-10 items-center justify-center rounded-md transition-all duration-200 hover:bg-white"
				title={item.template.name}
				aria-label="Create {item.template.name} node"
			>
				<item.icon class="h-5 w-5 text-gray-700 group-hover:text-gray-900" />
			</button>
		{/each}
	</div>
</div>
