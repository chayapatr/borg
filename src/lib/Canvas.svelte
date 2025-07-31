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
	import EditPanel from './EditPanel.svelte';
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

	// Edit panel state
	let showEditPanel = $state(false);
	let editNodeId = $state('');
	let editNodeData = $state({});
	let editTemplateType = $state('');

	// Get Svelte Flow helpers
	const { screenToFlowPosition, getViewport } = useSvelteFlow();

	// Helper function to get viewport center position
	function getViewportCenterPosition() {
		const flowWrapper =
			document.querySelector('.svelte-flow') ||
			document.querySelector('[data-testid="rf__wrapper"]');
		if (flowWrapper) {
			const rect = flowWrapper.getBoundingClientRect();
			const screenCenter = {
				x: rect.left + rect.width / 2,
				y: rect.top + rect.height / 2
			};
			return screenToFlowPosition(screenCenter);
		}
		// Fallback position
		return screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
	}

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
			// Use a small delay to ensure the Svelte Flow component is fully mounted
			setTimeout(() => {
				if (nodes.length === 0) {
					// Double-check in case nodes were loaded from storage
					const initialPosition = getViewportCenterPosition();
					nodesService.addNode('project', initialPosition);
				}
			}, 100);
		}

		// Listen for node events
		const handleNodeDeleteEvent = (event: CustomEvent) => {
			handleNodeDelete(event.detail.nodeId);
		};
		const handleNodeUpdateEvent = (event: CustomEvent) => {
			nodesService.updateNode(event.detail.nodeId, event.detail.data);
		};
		const handleNodeEditEvent = (event: CustomEvent) => {
			editNodeId = event.detail.nodeId;
			editNodeData = event.detail.nodeData;
			editTemplateType = event.detail.templateType;
			showEditPanel = true;
		};

		document.addEventListener('nodeDelete', handleNodeDeleteEvent as EventListener);
		document.addEventListener('nodeUpdate', handleNodeUpdateEvent as EventListener);
		document.addEventListener('nodeEdit', handleNodeEditEvent as EventListener);

		return () => {
			document.removeEventListener('nodeDelete', handleNodeDeleteEvent as EventListener);
			document.removeEventListener('nodeUpdate', handleNodeUpdateEvent as EventListener);
			document.removeEventListener('nodeEdit', handleNodeEditEvent as EventListener);
		};
	});

	function handleCanvasClick(event: MouseEvent) {
		const target = event.target as HTMLElement;
		// Check if clicking on the background pane (not on nodes, controls, etc.)
		// Use more specific targeting to avoid duplicate triggers
		if (
			target.classList.contains('svelte-flow__pane') ||
			target.classList.contains('react-flow__pane') ||
			(target.closest('.svelte-flow') &&
				!target.closest('.svelte-flow__node') &&
				!target.closest('.svelte-flow__controls') &&
				!target.closest('.svelte-flow__minimap') &&
				target === target.closest('.svelte-flow')?.querySelector('.svelte-flow__renderer'))
		) {
			// Prevent multiple rapid clicks
			if (showCreateModal) return;

			// Get the center of the viewport
			// createPosition = getViewportCenterPosition();
			// showCreateModal = true;
		}
	}

	function handleCreateNode(templateType: string) {
		// Prevent duplicate node creation if modal is already closing
		if (!showCreateModal) return;

		nodesService.addNode(templateType, createPosition);
		showCreateModal = false;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === '/' && !showCreateModal && !showEditPanel) {
			event.preventDefault();

			// Get the center of the viewport
			createPosition = getViewportCenterPosition();
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

	function handleEditPanelSave(nodeId: string, data: any) {
		nodesService.updateNode(nodeId, data);
		showEditPanel = false;
	}

	function handleEditPanelDelete(nodeId: string) {
		nodesService.deleteNode(nodeId);
		showEditPanel = false;
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
		deleteKey={null}
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

<EditPanel
	nodeId={editNodeId}
	nodeData={editNodeData}
	templateType={editTemplateType}
	bind:isOpen={showEditPanel}
	onSave={handleEditPanelSave}
	onDelete={handleEditPanelDelete}
/>
