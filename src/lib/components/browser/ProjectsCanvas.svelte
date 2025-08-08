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

	// Canvas storage for positions and edges only
	let canvasPositions = $state(new Map<string, { x: number; y: number }>());
	let edges = $state.raw<Edge[]>([]);
	let nodesService: INodesService;

	// Computed nodes: merge projects with canvas positions
	let nodes = $derived.by(() => {
		return projects.map((project, index) => createProjectNode(project, index));
	});

	onMount(() => {
		// Create nodes service for project-canvas (positions + edges only)
		nodesService = ServiceFactory.createNodesService(
			'project-canvas',
			(positionNodes) => {
				// Extract positions from loaded nodes
				const positions = new Map();
				positionNodes.forEach(node => {
					if (node.data?.nodeData?.projectId) {
						positions.set(node.data.nodeData.projectId, node.position);
					}
				});
				canvasPositions = positions;
			},
			() => [], // We don't store full nodes anymore
			(newEdges) => { edges = newEdges; },
			() => edges
		);

		// Load initial positions
		loadCanvasPositions();

		// Set up edge subscriptions only
		if (nodesService.subscribeToEdges) {
			const unsubscribeEdges = nodesService.subscribeToEdges((updatedEdges) => {
				edges = updatedEdges;
			});

			return () => {
				unsubscribeEdges();
			};
		}
	});

	async function loadCanvasPositions() {
		try {
			// Load existing position data from Firebase
			const existingNodes = await nodesService.getNodes();
			const positions = new Map();
			
			existingNodes.forEach(node => {
				if (node.data?.nodeData?.projectId) {
					positions.set(node.data.nodeData.projectId, node.position);
				}
			});
			
			canvasPositions = positions;
		} catch (error) {
			console.error('Failed to load canvas positions:', error);
		}
	}

	function createProjectNode(project: Project, index: number): Node {
		// Get the project template to initialize proper field structure
		const template = getTemplate('project');
		
		// Initialize nodeData based on template fields
		const nodeDataFields: Record<string, any> = {};
		template.fields.forEach((field) => {
			if (field.type === 'tags') {
				nodeDataFields[field.id] = [];
			} else {
				nodeDataFields[field.id] = '';
			}
		});

		// Populate with actual project data (always fresh from projects array)
		nodeDataFields.title = project.title;
		nodeDataFields.status = project.status || 'active';
		
		// Add project metadata for identification
		nodeDataFields.projectId = project.id;
		nodeDataFields.projectSlug = project.slug;

		// Use stored position or default grid position
		const savedPosition = canvasPositions.get(project.id);
		const position = savedPosition || {
			x: 100 + (index % 4) * 250,
			y: 100 + Math.floor(index / 4) * 200
		};

		return {
			id: `project-${project.id}`,
			type: 'universal',
			position,
			data: {
				templateType: 'project',
				nodeData: nodeDataFields
			}
		};
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

	async function handleNodeDragStop() {
		// Save only positions to Firebase, not full project data
		await savePositions();
	}

	async function savePositions() {
		try {
			// Create minimal position nodes for persistence
			const positionNodes: Node[] = [];
			
			nodes.forEach((node: Node) => {
				if (node.data?.nodeData?.projectId) {
					// Store position with minimal project reference
					positionNodes.push({
						id: `pos-${node.data.nodeData.projectId}`,
						type: 'universal',
						position: node.position,
						data: {
							templateType: 'project-position',
							nodeData: {
								projectId: node.data.nodeData.projectId
							}
						}
					});
				}
			});

			await nodesService.saveBatch(positionNodes, edges);
		} catch (error) {
			console.error('Failed to save positions:', error);
		}
	}

	async function handleToolbarCreateNode(templateType: string) {
		const position = {
			x: Math.random() * 400 + 100,
			y: Math.random() * 300 + 100
		};

		try {
			await nodesService.addNode(templateType, position);
		} catch (error) {
			console.error('Failed to create toolbar node:', error);
		}
	}

	// Handle project node clicks
	$effect(() => {
		const handleNodeEdit = (event: CustomEvent) => {
			const { nodeData } = event.detail;
			
			if (nodeData?.projectSlug) {
				onProjectClick(nodeData.projectSlug);
			}
		};

		document.addEventListener('nodeEdit', handleNodeEdit as EventListener);

		return () => {
			document.removeEventListener('nodeEdit', handleNodeEdit as EventListener);
		};
	});
</script>

<SvelteFlowProvider>
	<div class="relative flex h-full w-full bg-zinc-950">
		<!-- Canvas -->
		<div class="relative flex-1">
			<!-- Floating Toolbar -->
			<Toolbar onCreateNode={handleToolbarCreateNode} />
			
			<SvelteFlow
				class="h-full w-full bg-black"
				bind:nodes
				bind:edges
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
	</div>
</SvelteFlowProvider>