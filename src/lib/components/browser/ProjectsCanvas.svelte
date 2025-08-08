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

	let nodes = $state<Node[]>([]);
	let edges = $state<Edge[]>([]);
	let nodesService: INodesService;
	let initialized = $state(false);
	let unsubscribeFunctions: (() => void)[] = [];

	onMount(() => {
		let mounted = true;
		
		(async () => {
			try {
				initializeService();
				await loadInitialData();
				await syncProjectNodes();
				if (mounted) {
					initialized = true;
				}
			} catch (error) {
				console.error('Failed to initialize ProjectsCanvas:', error);
			}
		})();

		return () => {
			mounted = false;
			cleanup();
		};
	});

	function initializeService() {
		nodesService = ServiceFactory.createNodesService(
			'project-canvas',
			(newNodes) => { nodes = newNodes; },
			() => nodes,
			(newEdges) => { edges = newEdges; },
			() => edges,
			'project-canvas'
		);

		if (nodesService.subscribeToNodes && nodesService.subscribeToEdges) {
			const unsubscribeNodes = nodesService.subscribeToNodes((newNodes) => {
				nodes = newNodes;
			});
			
			const unsubscribeEdges = nodesService.subscribeToEdges((newEdges) => {
				edges = newEdges;
			});

			unsubscribeFunctions = [unsubscribeNodes, unsubscribeEdges];
		}
	}

	async function loadInitialData() {
		try {
			const [loadedNodes, loadedEdges] = await Promise.all([
				Promise.resolve(nodesService.getNodes()),
				Promise.resolve(nodesService.getEdges())
			]);
			
			nodes = Array.isArray(loadedNodes) ? loadedNodes : [];
			edges = Array.isArray(loadedEdges) ? loadedEdges : [];
		} catch (error) {
			console.error('Failed to load initial canvas data:', error);
			nodes = [];
			edges = [];
		}
	}

	async function syncProjectNodes() {
		if (!projects.length) return;

		const existingProjectIds = new Set(
			nodes
				.filter(node => node.data?.templateType === 'project')
				.map(node => (node.data?.nodeData as any)?.projectId)
				.filter(Boolean)
		);

		const newNodes: Node[] = [];
		
		projects.forEach((project: Project, index: number) => {
			if (!existingProjectIds.has(project.id)) {
				newNodes.push(createProjectNode(project, index + nodes.length));
			}
		});

		if (newNodes.length > 0) {
			try {
				await nodesService.saveBatch([...nodes, ...newNodes], edges);
			} catch (error) {
				console.error('Failed to sync project nodes:', error);
			}
		}
	}

	function createProjectNode(project: Project, gridIndex: number): Node {
		const template = getTemplate('project');
		
		const nodeDataFields: Record<string, any> = {};
		template.fields.forEach((field) => {
			nodeDataFields[field.id] = field.type === 'tags' ? [] : '';
		});

		nodeDataFields.title = project.title;
		nodeDataFields.status = project.status || 'To Do';
		nodeDataFields.projectId = project.id;
		nodeDataFields.projectSlug = project.slug;

		const position = {
			x: 150 + (gridIndex % 4) * 280,
			y: 150 + Math.floor(gridIndex / 4) * 220
		};

		return {
			id: `project-${project.id}`,
			type: 'universal',
			position,
			data: {
				templateType: 'project',
				nodeData: nodeDataFields
			},
			draggable: true
		};
	}

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
		if (!initialized) return;
		
		try {
			await nodesService.saveBatch(nodes, edges);
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

	$effect(() => {
		if (!initialized) return;
		
		const handleNodeEdit = (event: Event) => {
			const customEvent = event as CustomEvent;
			const { nodeData } = customEvent.detail;
			
			if (nodeData?.projectSlug) {
				onProjectClick(nodeData.projectSlug);
			}
		};

		const handleNodeDelete = async (event: Event) => {
			const customEvent = event as CustomEvent;
			const { nodeId } = customEvent.detail;
			
			if (nodeId && nodesService) {
				try {
					await nodesService.deleteNode(nodeId);
				} catch (error) {
					console.error('Failed to delete node:', error);
				}
			}
		};

		document.addEventListener('nodeEdit', handleNodeEdit);
		document.addEventListener('nodeDelete', handleNodeDelete);

		return () => {
			document.removeEventListener('nodeEdit', handleNodeEdit);
			document.removeEventListener('nodeDelete', handleNodeDelete);
		};
	});

	function cleanup() {
		unsubscribeFunctions.forEach(unsub => unsub());
		unsubscribeFunctions = [];
	}
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