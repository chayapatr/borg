<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { Edit, Trash2, FileText, ExternalLink } from '@lucide/svelte';
	import { ServiceFactory } from '../../services/ServiceFactory';
	import type { IWikiService } from '../../services/interfaces/IWikiService';
	import type { WikiEntry } from '../../types/wiki';
	import { goto } from '$app/navigation';

	let { data, id } = $props<{
		data: any;
		id: string;
		isBeingEdited?: boolean;
	}>();

	let nodeData = $derived(data.nodeData || {});
	let wikiService: IWikiService;
	let wikiTitle = $state<string>('');
	let subscriptionCleanup: (() => void) | null = null;

	// Initialize wiki service and subscribe to wiki entry for title sync
	$effect(() => {
		wikiService = ServiceFactory.createWikiService();

		// Clean up previous subscription
		if (subscriptionCleanup) {
			subscriptionCleanup();
			subscriptionCleanup = null;
		}

		// Subscribe to wiki entry if it exists
		if (nodeData.wikiId && (wikiService as any).subscribeToEntry) {
			subscriptionCleanup = (wikiService as any).subscribeToEntry(
				nodeData.wikiId,
				(entry: WikiEntry | null) => {
					if (entry) {
						wikiTitle = entry.title;
					}
				}
			);
		} else if (nodeData.wikiId) {
			// Fallback: fetch once
			(async () => {
				const entry = await wikiService.getEntry(nodeData.wikiId);
				if (entry) {
					wikiTitle = entry.title;
				}
			})();
		}

		return () => {
			if (subscriptionCleanup) {
				subscriptionCleanup();
				subscriptionCleanup = null;
			}
		};
	});

	// Display title: use synced wiki title if available, otherwise use node title
	let displayTitle = $derived(
		nodeData.wikiId && wikiTitle ? wikiTitle : nodeData.title || 'Untitled Wiki'
	);

	function handleEdit(e: MouseEvent) {
		e.stopPropagation();
		const event = new CustomEvent('nodeEdit', {
			detail: {
				nodeId: id,
				nodeData: nodeData,
				templateType: data.templateType
			}
		});
		document.dispatchEvent(event);
	}

	function handleDelete(e: MouseEvent) {
		e.stopPropagation();
		if (confirm('Are you sure you want to delete this wiki node?')) {
			const event = new CustomEvent('nodeDelete', { detail: { nodeId: id } });
			document.dispatchEvent(event);
		}
	}

	async function handleOpenWiki(e: MouseEvent) {
		e.stopPropagation();

		// If wiki already exists, open in new tab
		if (nodeData.wikiId) {
			window.open(`/wiki/${nodeData.wikiId}`, '_blank');
			return;
		}

		// Create a new wiki entry
		const wikiEntry = await wikiService.create({
			title: nodeData.title || 'Untitled Wiki',
			content: ''
		});

		// Update the node with the wiki ID
		const updatedNodeData = {
			...nodeData,
			wikiId: wikiEntry.id
		};

		data.nodeData = updatedNodeData;

		const event = new CustomEvent('nodeUpdate', {
			detail: {
				nodeId: id,
				data: {
					nodeData: updatedNodeData
				}
			}
		});
		document.dispatchEvent(event);

		// Open the wiki page in new tab
		window.open(`/wiki/${wikiEntry.id}`, '_blank');
	}

	function handleOpenInNewTab(e: MouseEvent) {
		e.stopPropagation();
		if (nodeData.wikiId) {
			window.open(`/wiki/${nodeData.wikiId}`, '_blank');
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="group relative">
	<div
		class="wiki-node relative rounded-lg border bg-white p-3 transition-all duration-200"
		style="min-width: 160px; max-width: 220px; border-color: #3b82f6;"
	>
		<!-- Wiki icon and title -->
		<div class="flex items-center gap-2">
			<FileText class="h-4 w-4 text-blue-500" />
			<span class="truncate text-sm font-medium text-gray-800">
				{displayTitle}
			</span>
		</div>

		<!-- Open wiki button -->
		<button
			class="mt-2 w-full rounded-lg bg-borg-brown/80 p-2 text-xs font-medium transition-colors hover:bg-borg-brown/60 focus:outline-none focus:ring-2 focus:ring-borg-blue"
			onclick={handleOpenWiki}
		>
			{#if nodeData.wikiId}
				Open Wiki [↗]
			{:else}
				Create Wiki [↗]
			{/if}
		</button>

		<!-- Connection handles -->
		<Handle type="target" position={Position.Left} class="!h-2 !w-2 !bg-zinc-600" />
		<Handle type="source" position={Position.Right} class="!h-2 !w-2 !bg-zinc-600" />
	</div>

	<!-- Action buttons -->
	<div class="absolute -top-5 right-0 flex gap-1">
		{#if nodeData.wikiId}
			<button
				onclick={handleOpenInNewTab}
				class="flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
				title="Open in new tab"
				aria-label="Open in new tab"
			>
				<ExternalLink class="h-3 w-3 text-gray-700 hover:text-borg-orange" />
			</button>
		{/if}
		<button
			onclick={handleEdit}
			class="flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
			title="Edit node"
			aria-label="Edit node"
		>
			<Edit class="h-3 w-3 text-gray-700 hover:text-borg-orange" />
		</button>
		<button
			class="flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
			title="Delete wiki node"
			aria-label="Delete wiki node"
			onclick={handleDelete}
		>
			<Trash2 class="h-3 w-3 text-gray-700 hover:text-borg-orange" />
		</button>
	</div>
</div>

<style>
	.wiki-node {
		user-select: none;
	}
</style>
