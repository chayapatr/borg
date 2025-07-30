<script lang="ts">
	import { onMount } from 'svelte';
	import {
		SvelteFlow,
		Background,
		Controls,
		MiniMap,
		useSvelteFlow,
		type Node,
		type Edge,
		type Connection
	} from '@xyflow/svelte';
	import UniversalNode from './UniversalNode.svelte';
	import { NodesService } from './services/NodesService';
	import CreateNodeModal from './CreateNodeModal.svelte';
	import '@xyflow/svelte/dist/style.css';

	const nodeTypes = {
		universal: UniversalNode
	};

	// Use $state.raw for better performance with arrays as shown in reference
	let nodes = $state.raw<Node[]>([]);
	let edges = $state.raw<Edge[]>([]);
	let nodesService: NodesService;
	let showCreateModal = $state(false);
	let createPosition = $state({ x: 0, y: 0 });
	let saveTimeout: number;

	// Auto-save positions when nodes change (e.g., after dragging)
	$effect(() => {
		if (nodesService && nodes.length > 0) {
			clearTimeout(saveTimeout);
			saveTimeout = setTimeout(() => {
				nodesService.saveToStorage(nodes, edges);
			}, 500);
		}
	});

	onMount(() => {
		nodesService = new NodesService(
			(newNodes) => {
				nodes = newNodes;
			},
			() => nodes,
			(newEdges) => {
				edges = newEdges;
			},
			() => edges
		);

		nodesService.loadFromStorage();

		// Add initial project node if none exist
		if (nodes.length === 0) {
			nodesService.addNode('project', { x: 400, y: 200 });
		}

		// Listen for node delete events
		const handleNodeDeleteEvent = (event: CustomEvent) => {
			handleNodeDelete(event.detail.nodeId);
		};
		const handleNodeUpdateEvent = (event: CustomEvent) => {
			nodesService.updateNode(event.detail.nodeId, event.detail.data);
		};

		document.addEventListener('nodeDelete', handleNodeDeleteEvent as EventListener);
		document.addEventListener('nodeUpdate', handleNodeUpdateEvent as EventListener);

		return () => {
			document.removeEventListener('nodeDelete', handleNodeDeleteEvent as EventListener);
			document.removeEventListener('nodeUpdate', handleNodeUpdateEvent as EventListener);
		};
	});

	function handleCanvasClick(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (target.classList.contains('react-flow__pane')) {
			const rect = target.getBoundingClientRect();
			createPosition = {
				x: event.clientX - rect.left,
				y: event.clientY - rect.top
			};
			showCreateModal = true;
		}
	}

	function handleCreateNode(templateType: string) {
		nodesService.addNode(templateType, createPosition);
		showCreateModal = false;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === '/' && !showCreateModal) {
			event.preventDefault();
			createPosition = { x: 400, y: 300 };
			showCreateModal = true;
		}
	}

	function handleConnect(connection: Connection) {
		const edge: Edge = {
			id: `edge-${connection.source}-${connection.target}`,
			source: connection.source!,
			target: connection.target!,
			type: 'default',
			style: 'stroke: #71717a; stroke-width: 2px;'
		};
		nodesService.addEdge(edge);
	}

	function handleNodeDelete(nodeId: string) {
		nodesService.deleteNode(nodeId);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<svelte:window on:keydown={handleKeyDown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="h-full w-full bg-zinc-950" onclick={handleCanvasClick}>
	<SvelteFlow
		bind:nodes
		bind:edges
		{nodeTypes}
		onconnect={handleConnect}
		colorMode="dark"
		nodesDraggable={true}
		nodesConnectable={true}
	>
		<Background />
		<Controls />
		<MiniMap />
	</SvelteFlow>
</div>

{#if showCreateModal}
	<CreateNodeModal
		position={createPosition}
		onCreate={handleCreateNode}
		onClose={() => (showCreateModal = false)}
	/>
{/if}
