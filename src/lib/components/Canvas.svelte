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
	import { ServiceFactory } from '../services/ServiceFactory';
	import type { INodesService, IProjectsService, ITaskService } from '../services/interfaces';
	import CreateNodeModal from './CreateNodeModal.svelte';
	import EditPanel from './EditPanel.svelte';
	import NodeTaskSidebar from './tasks/NodeTaskSidebar.svelte';
	import AddTaskModal from './tasks/AddTaskModal.svelte';
	import type { Task } from '../types/task';
	import '@xyflow/svelte/dist/style.css';

	let { projectSlug } = $props<{ projectSlug?: string }>();

	const nodeTypes = {
		universal: UniversalNode
	};

	// Use $state.raw for better performance with arrays as shown in reference
	let nodes = $state.raw<Node[]>([]);
	let edges = $state.raw<Edge[]>([]);
	let nodesService: INodesService;
	let projectsService: IProjectsService;
	let taskService: ITaskService;
	let showCreateModal = $state(false);
	let createPosition = $state({ x: 0, y: 0 });
	let saveTimeout: number;

	// Edit panel state
	let showEditPanel = $state(false);
	let editNodeId = $state('');
	let editNodeData = $state({});
	let editTemplateType = $state('');

	// Node task sidebar state
	let showNodeTaskSidebar = $state(false);
	let taskSidebarNodeId = $state('');
	let taskSidebarNodeTitle = $state('');
	let taskSidebarTasks = $state<Task[]>([]);

	// Add task modal state
	let showAddTaskModal = $state(false);
	let addTaskNodeId = $state('');

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
		if (nodesService) {
			clearTimeout(saveTimeout);
			saveTimeout = setTimeout(async () => {
				const result = nodesService.saveBatch(nodes, edges);
				if (result instanceof Promise) await result;
				// Update project node count if we have a project
				if (projectSlug && projectsService) {
					await projectsService.updateNodeCount(projectSlug, nodes.length);
				}
			}, 500);
		}
	});

	// Separate effect for immediate node count updates
	$effect(() => {
		if (projectSlug && projectsService && nodesService) {
			projectsService.updateNodeCount(projectSlug, nodes.length);
		}
	});

	// Effect to sync project node when project data might have changed
	$effect(() => {
		if (projectSlug && projectsService && nodes.length > 0) {
			const interval = setInterval(() => {
				syncProjectNode();
			}, 1000); // Check every second for project data changes

			return () => clearInterval(interval);
		}
	});

	onMount(() => {
		projectsService = ServiceFactory.createProjectsService();
		taskService = ServiceFactory.createTaskService();
		nodesService = ServiceFactory.createNodesService(
			'default-project', // TODO: Get actual project ID
			(newNodes) => {
				nodes = newNodes;
			},
			() => nodes,
			(newEdges) => {
				edges = newEdges;
			},
			() => edges,
			projectSlug
		);

		// Load initial data - localStorage services use loadFromStorage, Firebase services handle this internally
		if (nodesService.loadFromStorage) {
			nodesService.loadFromStorage();
		} else {
			// For Firebase services, load nodes and edges
			(async () => {
				try {
					const nodeResults = nodesService.getNodes();
					const edgeResults = nodesService.getEdges();

					const loadedNodes = nodeResults instanceof Promise ? await nodeResults : nodeResults;
					const loadedEdges = edgeResults instanceof Promise ? await edgeResults : edgeResults;

					nodes = loadedNodes;
					edges = loadedEdges;
				} catch (error) {
					console.error('Failed to load nodes and edges:', error);
				}
			})();
		}

		// Add initial project node if none exist, or sync existing project node
		if (nodes.length === 0) {
			// Use a small delay to ensure the Svelte Flow component is fully mounted
			setTimeout(() => {
				if (nodes.length === 0) {
					// Double-check in case nodes were loaded from storage
					const initialPosition = getViewportCenterPosition();
					createSyncedProjectNode(initialPosition);
				}
			}, 100);
		} else {
			// Sync existing project node with project data
			syncProjectNode();
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
			// Close task sidebar if open to avoid conflicts
			showNodeTaskSidebar = false;
		};

		const handleNodeTasksOpenEvent = (event: CustomEvent) => {
			taskSidebarNodeId = event.detail.nodeId;
			taskSidebarNodeTitle = event.detail.nodeTitle;
			taskSidebarTasks = event.detail.tasks;
			showNodeTaskSidebar = true;
			// Close edit panel if open to avoid conflicts
			showEditPanel = false;
		};

		const handleAddTaskEvent = (event: CustomEvent) => {
			addTaskNodeId = event.detail.nodeId;
			showAddTaskModal = true;
		};

		document.addEventListener('nodeDelete', handleNodeDeleteEvent as EventListener);
		document.addEventListener('nodeUpdate', handleNodeUpdateEvent as EventListener);
		document.addEventListener('nodeEdit', handleNodeEditEvent as EventListener);
		document.addEventListener('nodeTasksOpen', handleNodeTasksOpenEvent as EventListener);
		document.addEventListener('addTask', handleAddTaskEvent as EventListener);

		return () => {
			document.removeEventListener('nodeDelete', handleNodeDeleteEvent as EventListener);
			document.removeEventListener('nodeUpdate', handleNodeUpdateEvent as EventListener);
			document.removeEventListener('nodeEdit', handleNodeEditEvent as EventListener);
			document.removeEventListener('nodeTasksOpen', handleNodeTasksOpenEvent as EventListener);
			document.removeEventListener('addTask', handleAddTaskEvent as EventListener);
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

	async function handleBeforeDelete({
		nodes: nodesToDelete,
		edges: edgesToDelete
	}: {
		nodes: Node[];
		edges: Edge[];
	}) {
		// Prevent node deletion by returning false if any nodes would be deleted
		if (nodesToDelete.length > 0) {
			return false; // This should prevent the deletion
		}
		// Allow edge deletion
		return true;
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

	function handleNodeDelete(nodeId: string) {
		nodesService.deleteNode(nodeId);
	}

	function handleEditPanelSave(nodeId: string, data: any) {
		nodesService.updateNode(nodeId, data);

		// If this is a project node, sync changes back to project metadata
		const node = nodes.find((n) => n.id === nodeId);
		if (node && node.data.templateType === 'project' && projectSlug && projectsService) {
			const nodeData = data.nodeData;
			const updates: any = {};

			// Sync title, status, and collaborators back to project metadata
			if (nodeData.title !== undefined) {
				updates.title = nodeData.title;
			}
			if (nodeData.status !== undefined) {
				updates.status = nodeData.status;
			}
			if (nodeData.collaborators !== undefined) {
				updates.collaborators = nodeData.collaborators;
			}

			if (Object.keys(updates).length > 0) {
				projectsService.updateProject(projectSlug, updates);
			}
		}

		showEditPanel = false;
	}

	function handleEditPanelDelete(nodeId: string) {
		nodesService.deleteNode(nodeId);
		showEditPanel = false;
	}

	// Function to refresh task sidebar data and node display
	async function handleTasksUpdated() {
		// Always refresh node display to update task counts
		if (nodesService.loadFromStorage) {
			nodesService.loadFromStorage();
		} else {
			// For Firebase services, reload nodes to get updated data
			try {
				const nodeResults = nodesService.getNodes();
				const loadedNodes = nodeResults instanceof Promise ? await nodeResults : nodeResults;
				nodes = loadedNodes;
			} catch (error) {
				console.error('Failed to reload nodes:', error);
			}
		}

		// If sidebar is open, refresh its tasks too
		if (showNodeTaskSidebar && taskSidebarNodeId && taskService) {
			const tasksResult = taskService.getNodeTasks(taskSidebarNodeId, projectSlug);
			const updatedTasks = tasksResult instanceof Promise ? await tasksResult : tasksResult;
			taskSidebarTasks = [...updatedTasks];
		}
	}

	// Handle add task completion
	function handleAddTaskComplete() {
		showAddTaskModal = false;
		// Refresh task sidebar if it's open and refresh nodes
		handleTasksUpdated();
	}

	function createSyncedProjectNode(position: { x: number; y: number }) {
		if (!projectSlug || !projectsService) {
			nodesService.addNode('project', position);
			return;
		}

		const project = projectsService.getProject(projectSlug);
		if (!project) {
			nodesService.addNode('project', position);
			return;
		}

		// Create project node with synced data
		const id = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

		const nodeData = {
			title: project.title,
			status: project.status,
			collaborators: project.collaborators || [],
			website: ''
		};

		const newNode = {
			id,
			type: 'universal',
			position: { ...position },
			data: {
				templateType: 'project',
				nodeData
			}
		};

		const currentNodes = nodes;
		const updatedNodes = [...currentNodes, newNode];
		nodesService.setNodes(updatedNodes);
		const result = nodesService.saveBatch(updatedNodes, edges);
		if (result instanceof Promise) result.catch(console.error);
	}

	function syncProjectNode() {
		if (!projectSlug || !projectsService) return;

		const project = projectsService.getProject(projectSlug);
		if (!project) return;

		// Find ALL project nodes and sync them
		const projectNodes = nodes.filter((node) => node.data.templateType === 'project');

		if (projectNodes.length > 0) {
			let hasUpdates = false;
			const updatedNodes = nodes.map((node) => {
				if (node.data.templateType === 'project') {
					const currentTitle = node.data.nodeData?.title;
					const currentStatus = node.data.nodeData?.status;

					// Only update if title or status has changed
					if (currentTitle !== project.title || currentStatus !== project.status) {
						hasUpdates = true;
						return {
							...node,
							data: {
								...node.data,
								nodeData: {
									...node.data.nodeData,
									title: project.title,
									status: project.status,
									collaborators: project.collaborators || []
								}
							}
						};
					}
				}
				return node;
			});

			if (hasUpdates) {
				nodesService.setNodes(updatedNodes);
				const result = nodesService.saveBatch(updatedNodes, edges);
				if (result instanceof Promise) result.catch(console.error);
			}
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<svelte:window on:keydown={handleKeyDown} />

<!-- Canvas and Sidebar Container -->
<div class="flex h-full w-full bg-zinc-950">
	<!-- Canvas -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="flex-1" onclick={handleCanvasClick}>
		<SvelteFlow
			bind:nodes
			bind:edges
			{nodeTypes}
			onconnect={handleConnect}
			onbeforedelete={handleBeforeDelete}
			ondelete={handleDelete}
			colorMode="dark"
			nodesDraggable={true}
			nodesConnectable={true}
			deleteKey={['Delete', 'Backspace']}
			nodesDeletable={false}
			edgesDeletable={true}
		>
			<Background />
			<Controls />
			<MiniMap />
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

	<!-- Node Task Sidebar -->
	{#if showNodeTaskSidebar}
		<NodeTaskSidebar
			nodeId={taskSidebarNodeId}
			nodeTitle={taskSidebarNodeTitle}
			{projectSlug}
			tasks={taskSidebarTasks}
			onClose={() => (showNodeTaskSidebar = false)}
			onTasksUpdated={handleTasksUpdated}
		/>
	{/if}
</div>

{#if showCreateModal}
	<CreateNodeModal
		position={createPosition}
		onCreate={handleCreateNode}
		onClose={() => (showCreateModal = false)}
	/>
{/if}

{#if showAddTaskModal}
	<AddTaskModal
		nodeId={addTaskNodeId}
		{projectSlug}
		onClose={() => (showAddTaskModal = false)}
		onTaskAdded={handleAddTaskComplete}
	/>
{/if}
