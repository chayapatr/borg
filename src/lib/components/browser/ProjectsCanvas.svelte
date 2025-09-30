<script lang="ts">
	import { onMount } from 'svelte';
	import {
		SvelteFlow,
		SvelteFlowProvider,
		Background,
		Controls,
		MiniMap,
		useSvelteFlow,
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
	import { authStore } from '../../stores/authStore';
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

	// Svelte Flow helpers - will be initialized after SvelteFlow is ready
	let getViewport: any;
	let setViewport: any;
	let svelteFlowReady = $state(false);

	// Current working nodes (mutable for SvelteFlow)
	let workingNodes = $state<Node[]>([]);
	let lastProjectsLength = 0;

	// Handle lock state reactively - set draggable property based on lock state
	$effect(() => {
		if (workingNodes.length > 0) {
			workingNodes.forEach((node) => {
				if (node.data) {
					// Set draggable property based on lock state - locked nodes can't be dragged
					node.draggable = !(node.data.nodeData && node.data.nodeData.locked);
				}
			});
		}
	});

	// Edit panel state
	let showEditPanel = $state(false);
	let editNodeId = $state('');
	let editNodeData = $state({});
	let editTemplateType = $state('');

	// Sticker panel state
	let showStickerPanel = $state(false);

	// Search functionality
	let searchQuery = $state('');
	let matchingNodeIds = $state<string[]>([]);
	let currentMatchIndex = $state(0);

	function updateMatchingNodes() {
		const query = searchQuery.trim().toLowerCase();
		if (!query) {
			matchingNodeIds = [];
			currentMatchIndex = 0;
			// Clear all search styling when search is empty
			document.querySelectorAll('.search-highlighted').forEach((el) => {
				el.classList.remove('search-highlighted');
			});
			document.querySelectorAll('.search-dimmed').forEach((el) => {
				el.classList.remove('search-dimmed');
			});
			return;
		}

		matchingNodeIds = workingNodes
			.filter((node) => {
				// Search through all fields in nodeData
				const nodeData = node.data?.nodeData || {};
				const searchableText = Object.values(nodeData)
					.filter((value) => typeof value === 'string')
					.join(' ')
					.toLowerCase();
				return searchableText.includes(query);
			})
			.map((node) => node.id);

		currentMatchIndex = 0;
		if (matchingNodeIds.length > 0) {
			navigateToCurrentMatch();
		}
	}

	function navigateToCurrentMatch() {
		if (matchingNodeIds.length === 0) return;

		// Remove highlight and dimming from all nodes
		document.querySelectorAll('.search-highlighted').forEach((el) => {
			el.classList.remove('search-highlighted');
		});
		document.querySelectorAll('.search-dimmed').forEach((el) => {
			el.classList.remove('search-dimmed');
		});

		// Dim all non-matching nodes
		workingNodes.forEach((node) => {
			if (!matchingNodeIds.includes(node.id)) {
				const nodeElement = document.querySelector(`[data-id="${node.id}"]`);
				if (nodeElement) {
					nodeElement.classList.add('search-dimmed');
				}
			}
		});

		const nodeId = matchingNodeIds[currentMatchIndex];
		const node = workingNodes.find((n) => n.id === nodeId);
		if (node && node.position) {
			setViewport(
				{ x: -node.position.x + 400, y: -node.position.y + 300, zoom: 1 },
				{ duration: 300 }
			);

			// Add highlight to current node after a short delay to ensure it's rendered
			setTimeout(() => {
				const nodeElement = document.querySelector(`[data-id="${nodeId}"]`);
				if (nodeElement) {
					nodeElement.classList.add('search-highlighted');
				}
			}, 100);
		}
	}

	function nextMatch() {
		if (matchingNodeIds.length === 0) return;
		currentMatchIndex = (currentMatchIndex + 1) % matchingNodeIds.length;
		navigateToCurrentMatch();
	}

	function previousMatch() {
		if (matchingNodeIds.length === 0) return;
		currentMatchIndex = (currentMatchIndex - 1 + matchingNodeIds.length) % matchingNodeIds.length;
		navigateToCurrentMatch();
	}

	function updateWorkingNodes() {
		if (!mounted) {
			workingNodes = canvasNodes.slice();
			return;
		}

		if (!projects.length) {
			workingNodes = canvasNodes.slice();
			return;
		}

		// Create project nodes from projects array (exclude project-node)
		const projectNodes: Node[] = projects
			.filter((project: any) => project.id !== 'project-canvas')
			.map((project: any, index: number) => ({
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

		// Sort canvas nodes by Firebase's updatedAt timestamp (most recent last = on top)
		const sortedCanvasNodes = nonProjectCanvasNodes.sort((a, b) => {
			const aTime = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
			const bTime = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
			return aTime - bTime;
		});

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

	// Initialize Svelte Flow helpers after SvelteFlow is ready
	function initializeSvelteFlowHelpers() {
		if (!svelteFlowReady) {
			try {
				const svelteFlowHelpers = useSvelteFlow();
				getViewport = svelteFlowHelpers.getViewport;
				setViewport = svelteFlowHelpers.setViewport;
				svelteFlowReady = true;

				// Load viewport position after helpers are initialized
				setTimeout(() => {
					loadViewportPosition();
				}, 100);
			} catch (error) {
				console.error('Failed to initialize SvelteFlow helpers:', error);
			}
		}
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
		if (event && event.node) {
			const draggedNodeId = event.node.id;
			const draggedNode = workingNodes.find((node) => node.id === draggedNodeId);
			const otherNodes = workingNodes.filter((node) => node.id !== draggedNodeId);

			if (draggedNode) {
				// Move dragged node to the end of the array (renders on top)
				workingNodes = [...otherNodes, draggedNode];
			}
		}
	}

	async function handleNodeDragStop(event: any) {
		if (!mounted) return;

		try {
			if (event?.targetNode) {
				const draggedNodeId = event.targetNode.id;
				const draggedNode = workingNodes.find((node) => node.id === draggedNodeId);

				if (draggedNode) {
					console.log(
						'ProjectsCanvas: Saving position for node:',
						draggedNodeId,
						draggedNode.position
					);
					// Save only the dragged node - Firebase will set updatedAt for ordering
					await nodesService.saveBatch([draggedNode], []);
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

	// Viewport saving with debounce
	let viewportSaveTimeout: ReturnType<typeof setTimeout>;
	const VIEWPORT_SAVE_DELAY = 500; // Save after 500ms of inactivity

	// Functions for viewport position management
	async function saveViewportPosition() {
		if (!getViewport) return; // Not initialized yet

		const projectsService = ServiceFactory.createProjectsService();

		// Get current user ID
		const currentUser = $authStore.user;
		if (!currentUser) {
			console.log('ProjectsCanvas: No user logged in, cannot save viewport');
			return;
		}

		try {
			const viewport = getViewport();
			const viewportData = {
				x: viewport.x,
				y: viewport.y,
				zoom: viewport.zoom
			};

			console.log(
				'ProjectsCanvas: Attempting to save viewport position for user:',
				currentUser.uid,
				viewportData
			);

			// Get existing project-canvas project by slug
			const project = await projectsService.getProject('project-canvas');
			console.log('ProjectsCanvas: Existing project data:', project);

			// Get existing viewport positions object, or create new one
			const existingViewportPositions = (project as any)?.viewportPositions || {};

			// Update viewport position for current user
			const updatedViewportPositions = {
				...existingViewportPositions,
				[currentUser.uid]: viewportData
			};

			// Save viewport positions
			const result = await projectsService.updateProject('project-canvas', {
				viewportPositions: updatedViewportPositions
			} as any);
			console.log('ProjectsCanvas: Update result:', result);
			console.log(
				'ProjectsCanvas: Saved viewport position for user:',
				currentUser.uid,
				viewportData
			);
		} catch (error) {
			console.error('ProjectsCanvas: Failed to save viewport position:', error);
		}
	}

	async function loadViewportPosition() {
		if (!setViewport) return; // Not initialized yet

		const projectsService = ServiceFactory.createProjectsService();

		// Get current user ID
		const currentUser = $authStore.user;
		if (!currentUser) {
			console.log('ProjectsCanvas: No user logged in, cannot load viewport');
			return;
		}

		try {
			// Get project-canvas by slug
			const project = await projectsService.getProject('project-canvas');

			console.log('ProjectsCanvas: Loaded project data:', project);

			// Check for user-specific viewport position
			const userViewportPosition = (project as any)?.viewportPositions?.[currentUser.uid];

			if (userViewportPosition) {
				const { x, y, zoom } = userViewportPosition;
				// Use setTimeout to ensure SvelteFlow is fully mounted
				setTimeout(() => {
					setViewport({ x, y, zoom }, { duration: 0 });
					console.log(
						'ProjectsCanvas: Restored viewport position for user:',
						currentUser.uid,
						userViewportPosition
					);
				}, 0);
			} else {
				console.log('ProjectsCanvas: No saved viewport position found for user:', currentUser.uid);
			}
		} catch (error) {
			console.error('ProjectsCanvas: Failed to load viewport position:', error);
		}
	}

	function debouncedSaveViewport() {
		clearTimeout(viewportSaveTimeout);
		viewportSaveTimeout = setTimeout(() => {
			saveViewportPosition();
		}, VIEWPORT_SAVE_DELAY);
	}

	// Handle viewport move events
	function handleViewportChange() {
		// Initialize helpers if not ready
		if (!svelteFlowReady) {
			initializeSvelteFlowHelpers();
		}
		// Save position when user moves the viewport (debounced)
		debouncedSaveViewport();
	}
</script>

<SvelteFlowProvider>
	<div class="flex h-full w-full bg-zinc-950">
		<!-- Canvas -->
		<div class="relative flex-1">
			<!-- Floating Toolbar -->
			<Toolbar
				view="projects"
				onCreateNode={handleToolbarCreateNode}
				onShowStickers={handleShowStickers}
				{onCreateProject}
			/>

			<!-- Search Box -->
			<div class="absolute top-4 right-4 z-20 flex items-center gap-2">
				<input
					type="text"
					bind:value={searchQuery}
					oninput={updateMatchingNodes}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							e.shiftKey ? previousMatch() : nextMatch();
						}
					}}
					placeholder="Search nodes..."
					class="w-64 rounded-md border border-black bg-white px-3 py-2 text-sm text-black placeholder-zinc-400 focus:border-borg-blue focus:ring-1 focus:ring-borg-blue focus:outline-none"
				/>
				{#if matchingNodeIds.length > 0}
					<div class="flex items-center gap-1 rounded-md border border-black bg-white px-2 py-1">
						<span class="text-xs text-black">
							{currentMatchIndex + 1} / {matchingNodeIds.length}
						</span>
					</div>
					<button
						onclick={previousMatch}
						class="rounded-md border border-black bg-white p-2 text-black hover:bg-zinc-100"
						title="Previous (Shift+Enter)"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<polyline points="15 18 9 12 15 6"></polyline>
						</svg>
					</button>
					<button
						onclick={nextMatch}
						class="rounded-md border border-black bg-white p-2 text-black hover:bg-zinc-100"
						title="Next (Enter)"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<polyline points="9 18 15 12 9 6"></polyline>
						</svg>
					</button>
				{/if}
			</div>

			<!-- fitView -->

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
				oninit={initializeSvelteFlowHelpers}
				onmoveend={handleViewportChange}
				nodesDraggable={true}
				nodesConnectable={true}
				elevateNodesOnSelect={true}
				minZoom={0.3}
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
			<StickerPanel bind:isOpen={showStickerPanel} onClose={handleCloseStickerPanel} />
		{/if}
	</div>
</SvelteFlowProvider>
