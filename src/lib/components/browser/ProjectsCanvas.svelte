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
	import UniversalNode from '../UniversalNode.svelte';
	import Toolbar from '../Toolbar.svelte';
	import EditPanel from '../EditPanel.svelte';
	import { ServiceFactory } from '../../services/ServiceFactory';
	import type { INodesService } from '../../services/interfaces';
	import type { Project } from '../../services/local/ProjectsService';
	import { getTemplate } from '../../templates';
	import '@xyflow/svelte/dist/style.css';
	import '../svelteflow.css';

	let { projects, onProjectClick } = $props<{
		projects: Project[];
		onProjectClick: (slug: string) => void;
	}>();

	const nodeTypes = {
		universal: UniversalNode
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
		const projectNodes: Node[] = projects.map((project, index) => ({
			id: `project-${project.id}`,
			type: 'universal',
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

		// Filter out any project nodes from canvas nodes to avoid duplicates
		const nonProjectCanvasNodes = canvasNodes.filter(node => 
			!node.id.startsWith('project-')
		);

		// Merge existing working node positions with fresh project data
		const existingWorkingNodes = new Map(workingNodes.map(n => [n.id, n]));
		const updatedProjectNodes = projectNodes.map(pNode => {
			const existingNode = existingWorkingNodes.get(pNode.id);
			return existingNode ? { ...pNode, position: existingNode.position } : pNode;
		});

		workingNodes = [...updatedProjectNodes, ...nonProjectCanvasNodes];
	}

	function getProjectNodePosition(projectId: string, defaultIndex: number) {
		// Try to find existing position from canvas nodes
		const existingNode = canvasNodes.find(node => node.id === `project-${projectId}`);
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
				(nodes) => { canvasNodes = nodes; },
				() => canvasNodes,
				(edges) => { canvasEdges = edges; },
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

	async function handleNodeDragStop() {
		if (!mounted) return;
		
		try {
			// Save all current node positions to canvas
			await nodesService.saveBatch(workingNodes, canvasEdges);
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

		document.addEventListener('nodeEdit', handleNodeEdit);
		document.addEventListener('nodeDelete', handleNodeDelete);
		document.addEventListener('nodeUpdate', handleNodeUpdate);

		return () => {
			document.removeEventListener('nodeEdit', handleNodeEdit);
			document.removeEventListener('nodeDelete', handleNodeDelete);
			document.removeEventListener('nodeUpdate', handleNodeUpdate);
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
</script>

<SvelteFlowProvider>
	<div class="flex h-full w-full bg-zinc-950">
		<!-- Canvas -->
		<div class="relative flex-1">
			<!-- Floating Toolbar -->
			<Toolbar onCreateNode={handleToolbarCreateNode} />
			
			<SvelteFlow
				class="h-full w-full bg-black"
				bind:nodes={workingNodes}
				bind:edges={canvasEdges}
				{nodeTypes}
				onconnect={handleConnect}
				onnodedragstop={handleNodeDragStop}
				nodesDraggable={true}
				nodesConnectable={true}
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
	</div>
</SvelteFlowProvider>