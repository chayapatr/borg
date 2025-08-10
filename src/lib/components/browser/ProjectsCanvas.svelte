<script lang="ts">
	import { onMount } from 'svelte';
	import {
		SvelteFlow,
		SvelteFlowProvider,
		Background,
		Controls,
		MiniMap,
		type Node,
		type Edge,
		type Connection
	} from '@xyflow/svelte';
	import UniversalNode from '../UniversalNode/UniversalNode.svelte';
	import NoteNode from '../UniversalNode/NoteNode.svelte';
	import ProjectCanvasNode from '../ProjectCanvasNode.svelte';
	import StickerNode from '../UniversalNode/StickerNode.svelte';
	import Toolbar from '../Toolbar.svelte';
	import EditPanel from '../EditPanel.svelte';
	import StickerPanel from '../stickers/StickerPanel.svelte';
	import { ServiceFactory } from '../../services/ServiceFactory';
	import type { INodesService } from '../../services/interfaces';
	import type { Project } from '../../services/local/ProjectsService';
	import { getTemplate } from '../../templates';
	import '@xyflow/svelte/dist/style.css';
	import '../svelteflow.css';

	let { projects, onProjectClick, onCreateProject, onProjectUpdate } = $props<{
		projects: Project[];
		onProjectClick: (slug: string) => void;
		onCreateProject?: () => void;
		onProjectUpdate?: () => void;
	}>();

	const nodeTypes = {
		universal: UniversalNode,
		projectCanvas: ProjectCanvasNode,
		sticker: StickerNode
	};

	let canvasNodes = $state<Node[]>([]);
	let canvasEdges = $state<Edge[]>([]);
	let nodesService: INodesService;
	let mounted = $state(false);

	// Current working nodes (mutable for SvelteFlow)
	let workingNodes = $state<Node[]>([]);
	let lastProjectsLength = 0;

	// Edit panel state
	let showEditPanel = $state(false);
	let editNodeId = $state('');
	let editNodeData = $state({});
	let editTemplateType = $state('');

	// Sticker panel state
	let showStickerPanel = $state(false);

	function updateWorkingNodes() {
		if (!mounted) {
			workingNodes = canvasNodes.slice();
			return;
		}

		if (!projects.length) {
			workingNodes = canvasNodes.slice();
			return;
		}

		// Create project nodes from projects array
		const projectNodes: Node[] = projects.map((project: any, index: number) => ({
			id: `project-${project.id}`,
			type: 'projectCanvas',
			position: getProjectNodePosition(project.id, index),
			data: {
				templateType: 'project',
				nodeData: {
					title: project.title,
					status: project.status || 'To Do',
					collaborators: project.collaborators || [],
					website: project.website || '',
					projectId: project.id,
					projectSlug: project.slug
				}
			},
			draggable: true
		}));

		// Get non-project canvas nodes (these maintain their own ordering)
		const nonProjectCanvasNodes = canvasNodes.filter((node) => !node.id.startsWith('project-'));

		// Preserve existing order of workingNodes when updating
		const existingWorkingNodes = new Map(workingNodes.map((n) => [n.id, n]));
		const existingProjectNodeOrder = workingNodes.filter((node) => node.id.startsWith('project-'));
		
		// Update existing project nodes with fresh data while preserving order
		const orderedUpdatedProjectNodes: Node[] = [];
		const processedIds = new Set<string>();

		// First, add existing project nodes in their current order (if they still exist in projects)
		for (const existingNode of existingProjectNodeOrder) {
			const matchingProjectNode = projectNodes.find((pNode) => pNode.id === existingNode.id);
			if (matchingProjectNode) {
				// Update with fresh data but keep position from existing
				orderedUpdatedProjectNodes.push({
					...matchingProjectNode,
					position: existingNode.position
				});
				processedIds.add(existingNode.id);
			}
		}

		// Then, add any new project nodes that weren't in the existing order
		for (const pNode of projectNodes) {
			if (!processedIds.has(pNode.id)) {
				orderedUpdatedProjectNodes.push(pNode);
			}
		}

		// Sort canvas nodes by Firebase's updatedAt timestamp
		console.log('🟦 Canvas nodes with updatedAt:',
			nonProjectCanvasNodes.map(n => ({
				id: n.id, 
				updatedAt: n.updatedAt?.toMillis ? n.updatedAt.toMillis() : 0
			}))
		);
		
		const sortedCanvasNodes = nonProjectCanvasNodes.sort((a, b) => {
			const aTime = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
			const bTime = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
			return aTime - bTime;
		});
		
		console.log('🟦 Canvas nodes after sorting:',
			sortedCanvasNodes.map(n => ({
				id: n.id, 
				updatedAt: n.updatedAt?.toMillis ? n.updatedAt.toMillis() : 0
			}))
		);
		
		workingNodes = [...orderedUpdatedProjectNodes, ...sortedCanvasNodes];
	}

	function getProjectNodePosition(projectId: string, defaultIndex: number) {
		// Try to find existing position from canvas nodes
		const existingNode = canvasNodes.find((node) => node.id === `project-${projectId}`);
		if (existingNode?.position) {
			return existingNode.position;
		}

		// Default grid position
		return {
			x: 150 + (defaultIndex % 4) * 280,
			y: 150 + Math.floor(defaultIndex / 4) * 220
		};
	}

	onMount(async () => {
		try {
			// Initialize service
			nodesService = ServiceFactory.createNodesService(
				'project-canvas',
				(nodes) => {
					canvasNodes = nodes;
				},
				() => canvasNodes,
				(edges) => {
					canvasEdges = edges;
				},
				() => canvasEdges,
				'project-canvas'
			);

			// Load initial canvas data (non-project nodes and positions)
			const [initialNodes, initialEdges] = await Promise.all([
				Promise.resolve(nodesService.getNodes()),
				Promise.resolve(nodesService.getEdges())
			]);

			canvasNodes = Array.isArray(initialNodes) ? initialNodes : [];
			canvasEdges = Array.isArray(initialEdges) ? initialEdges : [];

			// Set up subscriptions for canvas nodes only
			if (nodesService.subscribeToNodes && nodesService.subscribeToEdges) {
				nodesService.subscribeToNodes((nodes) => {
					canvasNodes = nodes;
					updateWorkingNodes();
				});

				nodesService.subscribeToEdges((edges) => {
					canvasEdges = edges;
				});
			}

			mounted = true;
			updateWorkingNodes();
		} catch (error) {
			console.error('Failed to initialize ProjectsCanvas:', error);
		}
	});

	function handleConnect(connection: Connection) {
		if (!connection.source || !connection.target) return;

		const edge: Edge = {
			id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
			source: connection.source,
			target: connection.target,
			type: 'default',
			style: 'stroke: #71717a; stroke-width: 2px;'
		};

		nodesService.addEdge(edge);
	}

	function handleBeforeDelete({
		nodes: nodesToDelete,
		edges: edgesToDelete
	}: {
		nodes: Node[];
		edges: Edge[];
	}): Promise<boolean> {
		// Prevent node deletion by returning false if any nodes would be deleted
		if (nodesToDelete.length > 0) {
			return Promise.resolve(false); // This should prevent the deletion
		}
		// Allow edge deletion
		return Promise.resolve(true);
	}

	function handleDelete({
		nodes: nodesToDelete,
		edges: edgesToDelete
	}: {
		nodes: Node[];
		edges: Edge[];
	}) {
		// This should only be called for edges now due to onbeforedelete
		edgesToDelete.forEach((edge) => {
			nodesService.deleteEdge(edge.id);
		});
	}


	function handleNodeDragStart(event: any) {
		console.log('Node drag started, bringing to front...', event);
		if (event && event.node) {
			const draggedNodeId = event.node.id;
			// Remove the dragged node from its current position
			const draggedNode = workingNodes.find(node => node.id === draggedNodeId);
			const otherNodes = workingNodes.filter(node => node.id !== draggedNodeId);
			
			if (draggedNode) {
				// Move dragged node to the end of the array (renders on top)
				workingNodes = [...otherNodes, draggedNode];
			}
		}
	}

	async function handleNodeDragStop(event: any) {
		console.log('🔴 Node drag stopped, saving positions...', event);
		if (!mounted) return;

		try {
			if (event?.targetNode && !event.targetNode.id.startsWith('project-')) {
				const draggedNodeId = event.targetNode.id;
				console.log('🔴 Saving only dragged node:', draggedNodeId);
				
				// Find the dragged node in workingNodes and save just that one
				const draggedNode = workingNodes.find(node => node.id === draggedNodeId);
				if (draggedNode) {
					// Save only the dragged node without edges - this will give it a unique updatedAt timestamp
					await nodesService.saveBatch([draggedNode], []);
					console.log('🔴 Save completed for:', draggedNodeId);
				}
			}
		} catch (error) {
			console.error('Failed to save node positions:', error);
		}
	}

	async function handleToolbarCreateNode(templateType: string) {
		const position = {
			x: Math.random() * 600 + 200,
			y: Math.random() * 400 + 200
		};

		try {
			await nodesService.addNode(templateType, position);
		} catch (error) {
			console.error('Failed to create node:', error);
		}
	}

	// Check for projects changes
	$effect(() => {
		if (mounted && projects.length !== lastProjectsLength) {
			lastProjectsLength = projects.length;
			updateWorkingNodes();
		}
	});

	// Handle node events
	$effect(() => {
		if (!mounted) return;

		const handleNodeEdit = (event: Event) => {
			const customEvent = event as CustomEvent;
			const { nodeId, nodeData, templateType } = customEvent.detail;

			// For project nodes, navigate to project
			if (nodeData?.projectSlug) {
				onProjectClick(nodeData.projectSlug);
				return;
			}

			// For other nodes (like post-it notes), show edit panel
			editNodeId = nodeId;
			editNodeData = nodeData;
			editTemplateType = templateType;
			showEditPanel = true;
		};

		const handleNodeDelete = async (event: Event) => {
			const customEvent = event as CustomEvent;
			const { nodeId } = customEvent.detail;

			// Don't allow deleting project nodes
			if (nodeId?.startsWith('project-')) {
				alert('Project nodes cannot be deleted as they sync with workspace metadata.');
				return;
			}

			if (nodeId && nodesService) {
				try {
					await nodesService.deleteNode(nodeId);
				} catch (error) {
					console.error('Failed to delete node:', error);
				}
			}
		};

		const handleNodeUpdate = async (event: Event) => {
			const customEvent = event as CustomEvent;
			const { nodeId, data } = customEvent.detail;

			if (nodeId && nodesService && data) {
				try {
					await nodesService.updateNode(nodeId, data);
				} catch (error) {
					console.error('Failed to update node:', error);
				}
			}
		};

		const handleAddStickerEvent = (event: Event) => {
			const customEvent = event as CustomEvent;
			handleAddSticker(customEvent);
		};

		document.addEventListener('nodeEdit', handleNodeEdit);
		document.addEventListener('nodeDelete', handleNodeDelete);
		document.addEventListener('nodeUpdate', handleNodeUpdate);
		document.addEventListener('addSticker', handleAddStickerEvent);

		return () => {
			document.removeEventListener('nodeEdit', handleNodeEdit);
			document.removeEventListener('nodeDelete', handleNodeDelete);
			document.removeEventListener('nodeUpdate', handleNodeUpdate);
			document.removeEventListener('addSticker', handleAddStickerEvent);
		};
	});

	function handleEditPanelSave(nodeId: string, data: any) {
		console.log('ProjectsCanvas.handleEditPanelSave called:', { nodeId, data });
		nodesService.updateNode(nodeId, data);
		showEditPanel = false;
	}

	function handleEditPanelDelete(nodeId: string) {
		console.log('ProjectsCanvas.handleEditPanelDelete called for:', nodeId);

		// Don't allow deleting project nodes
		if (nodeId?.startsWith('project-')) {
			alert('Project nodes cannot be deleted as they sync with workspace metadata.');
			return;
		}

		try {
			nodesService.deleteNode(nodeId);
			showEditPanel = false;
		} catch (error) {
			console.error('Failed to delete node:', error);
			alert('Failed to delete node. Check console for details.');
		}
	}

	function handleShowStickers() {
		showStickerPanel = true;
	}

	function handleCloseStickerPanel() {
		showStickerPanel = false;
	}

	async function handleAddSticker(event: CustomEvent) {
		if (!nodesService) return;
		
		try {
			const stickerData = event.detail;
			
			if (stickerData.type === 'sticker') {
				// Create sticker at center of viewport with some randomization
				const position = {
					x: Math.random() * 600 + 200,
					y: Math.random() * 400 + 200
				};
				
				// First create a basic sticker node using the service
				const baseNode = await nodesService.addNode('sticker', position);
				
				// Then immediately update it with the sticker-specific data
				const stickerNodeData = {
					title: stickerData.name,
					stickerUrl: stickerData.stickerUrl,
					category: stickerData.category,
					filename: stickerData.filename,
					width: 100,
					height: 100,
					rotation: 0
				};
				
				await nodesService.updateNode(baseNode.id, {
					nodeData: stickerNodeData
				});
			}
		} catch (error) {
			console.error('Failed to create sticker:', error);
		}
	}
</script>

<SvelteFlowProvider>
	<div class="flex h-full w-full bg-zinc-950">
		<!-- Canvas -->
		<div class="relative flex-1">
			<!-- Floating Toolbar -->
			<Toolbar view="projects" onCreateNode={handleToolbarCreateNode} onShowStickers={handleShowStickers} onCreateProject={onCreateProject} />

			<SvelteFlow
				class="h-full w-full bg-black"
				bind:nodes={workingNodes}
				bind:edges={canvasEdges}
				{nodeTypes}
				onconnect={handleConnect}
				onbeforedelete={handleBeforeDelete}
				ondelete={handleDelete}
				onnodedragstart={handleNodeDragStart}
				onnodedragstop={handleNodeDragStop}
				nodesDraggable={true}
				nodesConnectable={true}
				elevateNodesOnSelect={true}
				deleteKey={['Delete', 'Backspace']}
			>
				<Background />
				<Controls />
				<MiniMap class="border border-black" />
			</SvelteFlow>
		</div>

		<!-- Edit Sidebar -->
		{#if showEditPanel}
			<EditPanel
				nodeId={editNodeId}
				nodeData={editNodeData}
				templateType={editTemplateType}
				bind:isOpen={showEditPanel}
				onSave={handleEditPanelSave}
				onDelete={handleEditPanelDelete}
			/>
		{/if}

		<!-- Sticker Panel -->
		{#if showStickerPanel}
			<StickerPanel 
				bind:isOpen={showStickerPanel} 
				onClose={handleCloseStickerPanel}
			/>
		{/if}
	</div>
</SvelteFlowProvider>
