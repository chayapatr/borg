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
	import TaskModal from './tasks/TaskModal.svelte';
	import Toolbar from './Toolbar.svelte';
	import type { Task } from '../types/task';
	import '@xyflow/svelte/dist/style.css';
	import './svelteflow.css';

	let { projectSlug, onProjectUpdate } = $props<{
		projectSlug?: string;
		onProjectUpdate?: () => void;
	}>();

	const nodeTypes = {
		universal: UniversalNode
	};

	// Use $state.raw for better performance with arrays as shown in reference
	let nodes = $state.raw<Node[]>([]);
	let edges = $state.raw<Edge[]>([]);
	let previousNodes = $state.raw<Node[]>([]);
	let previousEdges = $state.raw<Edge[]>([]);
	let nodesService: INodesService;
	let projectsService: IProjectsService;
	let taskService: ITaskService;
	let showCreateModal = $state(false);
	let createPosition = $state({ x: 0, y: 0 });
	let saveTimeout: ReturnType<typeof setTimeout>;
	let hasAttemptedProjectNodeCreation = false;

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
	let taskSubscriptionCleanup: (() => void) | null = null;

	// Task modal state
	let showTaskModal = $state(false);
	let taskModalNodeId = $state('');
	let taskModalTask = $state<Task | undefined>(undefined); // undefined for add mode, Task for edit mode

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
				// Use optimized batch save if available, otherwise fall back to regular batch save
				if (
					'saveBatchOptimized' in nodesService &&
					typeof (nodesService as any).saveBatchOptimized === 'function'
				) {
					const result = (nodesService as any).saveBatchOptimized(
						nodes,
						edges,
						previousNodes,
						previousEdges
					);
					if (result instanceof Promise) await result;
				} else {
					const result = nodesService.saveBatch(nodes, edges);
					if (result instanceof Promise) await result;
				}

				// Update previous state after saving
				previousNodes = [...nodes];
				previousEdges = [...edges];

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

		// Initialize services asynchronously to get actual project ID
		(async () => {
			// Get the actual project ID from project slug
			let actualProjectId = 'default-project';
			if (projectSlug && projectsService) {
				try {
					const project = projectsService.getProject
						? await projectsService.getProject(projectSlug)
						: projectsService.getProject(projectSlug);

					if (project) {
						actualProjectId = project.id;
					}
				} catch (error) {
					console.error('Failed to load project:', error);
				}
			}

			nodesService = ServiceFactory.createNodesService(
				actualProjectId,
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

			// Load initial data - localStorage services use loadFromStorage, Firebase services use subscriptions
			if (nodesService.loadFromStorage) {
				// localStorage service
				nodesService.loadFromStorage();
			} else {
				// Firebase service - set up real-time subscriptions
				console.log('Setting up Firebase subscriptions...');
				console.log('nodesService methods:', {
					subscribeToNodes: !!nodesService.subscribeToNodes,
					subscribeToEdges: !!nodesService.subscribeToEdges
				});

				if (nodesService.subscribeToNodes && nodesService.subscribeToEdges) {
					console.log('Setting up real-time subscriptions');
					// Subscribe to real-time updates
					const unsubscribeNodes = nodesService.subscribeToNodes((updatedNodes) => {
						console.log('Canvas received nodes update:', updatedNodes.length, 'nodes');
						nodes = updatedNodes;
						// Initialize previous state if empty (first load)
						if (previousNodes.length === 0) {
							previousNodes = [...updatedNodes];
						}

						// Check if we need to create initial project node
						if (updatedNodes.length === 0 && !hasAttemptedProjectNodeCreation) {
							hasAttemptedProjectNodeCreation = true;
							console.log('No nodes found, creating initial project node');
							setTimeout(() => {
								const initialPosition = getViewportCenterPosition();
								createSyncedProjectNode(initialPosition);
							}, 100);
						}
					});

					const unsubscribeEdges = nodesService.subscribeToEdges((updatedEdges) => {
						console.log('Canvas received edges update:', updatedEdges.length, 'edges');
						edges = updatedEdges;
						// Initialize previous state if empty (first load)
						if (previousEdges.length === 0) {
							previousEdges = [...updatedEdges];
						}
					});

					// Clean up subscriptions on component destroy
					return () => {
						console.log('Cleaning up Firebase subscriptions');
						unsubscribeNodes();
						unsubscribeEdges();
					};
				} else {
					// Fallback to manual loading if subscriptions not available
					try {
						const nodeResults = nodesService.getNodes();
						const edgeResults = nodesService.getEdges();

						const loadedNodes = nodeResults instanceof Promise ? await nodeResults : nodeResults;
						const loadedEdges = edgeResults instanceof Promise ? await edgeResults : edgeResults;

						nodes = loadedNodes;
						edges = loadedEdges;
						// Initialize previous state for local storage
						previousNodes = [...loadedNodes];
						previousEdges = [...loadedEdges];
					} catch (error) {
						console.error('Failed to load nodes and edges:', error);
					}
				}
			}

			// For localStorage services, handle initial project node creation
			if (nodesService.loadFromStorage) {
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
			}
		})();

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
			// Clean up previous subscription if any
			if (taskSubscriptionCleanup) {
				taskSubscriptionCleanup();
				taskSubscriptionCleanup = null;
			}

			taskSidebarNodeId = event.detail.nodeId;
			taskSidebarNodeTitle = event.detail.nodeTitle;
			taskSidebarTasks = event.detail.tasks;
			showNodeTaskSidebar = true;

			// Set up real-time subscription if available
			if (taskService.subscribeToNodeTasks) {
				taskSubscriptionCleanup = taskService.subscribeToNodeTasks(
					event.detail.nodeId,
					(updatedTasks) => {
						console.log('Real-time task update:', updatedTasks);
						taskSidebarTasks = [...updatedTasks];
					},
					projectSlug
				);
			}

			// Close edit panel if open to avoid conflicts
			showEditPanel = false;
		};

		const handleAddTaskEvent = (event: CustomEvent) => {
			taskModalNodeId = event.detail.nodeId;
			taskModalTask = undefined; // undefined = add mode
			showTaskModal = true;
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

			// Clean up task subscription
			if (taskSubscriptionCleanup) {
				taskSubscriptionCleanup();
				taskSubscriptionCleanup = null;
			}
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
		if (!showCreateModal || !nodesService) return;

		(nodesService as any).addNode(templateType, createPosition);
		showCreateModal = false;
	}

	function handleToolbarCreateNode(templateType: string) {
		if (!nodesService) return;

		// Get the center of the viewport for toolbar-created nodes
		const centerPosition = getViewportCenterPosition();
		(nodesService as any).addNode(templateType, centerPosition);
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
		console.log('Canvas.handleEditPanelSave called:', { nodeId, data });
		nodesService.updateNode(nodeId, data);

		// Check if status changed - if so, trigger project update to refresh status counts
		const hasStatusChange = data.nodeData && data.nodeData.status !== undefined;

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

		// Notify parent component to refresh project data if status changed
		if (hasStatusChange && onProjectUpdate) {
			onProjectUpdate();
		}

		showEditPanel = false;
	}

	function handleEditPanelDelete(nodeId: string) {
		console.log('Canvas.handleEditPanelDelete called for:', nodeId);
		console.log('nodesService:', nodesService);

		try {
			const result = nodesService.deleteNode(nodeId);
			console.log('deleteNode result:', result);
			showEditPanel = false;
		} catch (error) {
			console.error('Failed to delete node:', error);
			alert('Failed to delete node. Check console for details.');
		}
	}

	// Handle node drag start to bring node to front by reordering array
	function handleNodeDragStart(event: any) {
		console.log('Node drag started, bringing to front...', event);
		if (event && event.node) {
			const draggedNodeId = event.node.id;
			// Remove the dragged node from its current position
			const draggedNode = nodes.find(node => node.id === draggedNodeId);
			const otherNodes = nodes.filter(node => node.id !== draggedNodeId);
			
			if (draggedNode) {
				// Move dragged node to the end of the array (renders on top)
				// The updatedAt will be set when saving, which will persist this ordering
				nodes = [...otherNodes, draggedNode];
			}
		}
	}

	// Handle node drag stop to save position immediately
	function handleNodeDragStop(event: any) {
		console.log('Node drag stopped, saving positions...', event);
		console.log(
			'Current nodes state:',
			nodes.map((n) => ({ id: n.id, position: n.position }))
		);

		if (nodesService) {
			// Use optimized batch save if available for immediate drag save
			if (
				'saveBatchOptimized' in nodesService &&
				typeof (nodesService as any).saveBatchOptimized === 'function'
			) {
				const result = (nodesService as any).saveBatchOptimized(
					nodes,
					edges,
					previousNodes,
					previousEdges
				);
				if (result instanceof Promise) {
					result
						.then(() => {
							console.log('Positions saved after drag (optimized)');
							// Update previous state after saving
							previousNodes = [...nodes];
							previousEdges = [...edges];
						})
						.catch((error) => {
							console.error('Failed to save positions after drag:', error);
						});
				} else {
					// Update previous state after saving
					previousNodes = [...nodes];
					previousEdges = [...edges];
				}
			} else if (nodesService.saveBatch) {
				const result = nodesService.saveBatch(nodes, edges);
				if (result instanceof Promise) {
					result
						.then(() => {
							console.log('Positions saved after drag');
							// Update previous state after saving
							previousNodes = [...nodes];
							previousEdges = [...edges];
						})
						.catch((error) => {
							console.error('Failed to save positions after drag:', error);
						});
				} else {
					// Update previous state after saving
					previousNodes = [...nodes];
					previousEdges = [...edges];
				}
			}
		}

		// Also try to save individual node position if the dragged node is available
		if (event && event.node) {
			const draggedNode = event.node;
			console.log('Dragged node:', draggedNode.id, 'new position:', draggedNode.position);

			// Update the node in the service individually
			if (nodesService.updateNode) {
				const updateResult = nodesService.updateNode(draggedNode.id, {
					position: draggedNode.position
				});
				if (updateResult instanceof Promise) {
					updateResult
						.then(() => {
							console.log('Individual node position saved:', draggedNode.id);
						})
						.catch((error) => {
							console.error('Failed to save individual node position:', error);
						});
				}
			}
		}
	}

	// Function to refresh task sidebar data and node display
	async function handleTasksUpdated() {
		console.log('Canvas: handleTasksUpdated called');

		// Dispatch global event to force all UniversalNode components to refresh
		const refreshEvent = new CustomEvent('tasksUpdated', {
			detail: { timestamp: Date.now() }
		});
		document.dispatchEvent(refreshEvent);
		console.log('Canvas: tasksUpdated event dispatched');

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
			console.log('Canvas: Refreshing sidebar tasks for node:', taskSidebarNodeId);
			const tasksResult = taskService.getNodeTasks(taskSidebarNodeId, projectSlug);
			const updatedTasks = tasksResult instanceof Promise ? await tasksResult : tasksResult;
			console.log('Canvas: Updated sidebar tasks:', updatedTasks.length);
			taskSidebarTasks = [...updatedTasks];
		}
	}

	// Handle task modal completion
	function handleTaskModalComplete() {
		showTaskModal = false;
		// Refresh task sidebar if it's open and refresh nodes
		handleTasksUpdated();
	}

	async function createSyncedProjectNode(position: { x: number; y: number }) {
		if (!projectSlug || !projectsService || !nodesService) {
			if (nodesService) {
				const result = (nodesService as any).addNode('project', position);
				if (result instanceof Promise) result.catch(console.error);
			}
			return;
		}

		// Get project data
		let project: any;
		try {
			const projectResult = projectsService.getProject(projectSlug);
			project = projectResult instanceof Promise ? await projectResult : projectResult;
		} catch (error) {
			console.error('Failed to load project for node creation:', error);
			if (nodesService) {
				const result = (nodesService as any).addNode('project', position);
				if (result instanceof Promise) result.catch(console.error);
			}
			return;
		}

		if (!project) {
			if (nodesService) {
				const result = (nodesService as any).addNode('project', position);
				if (result instanceof Promise) result.catch(console.error);
			}
			return;
		}

		// Use the service's addNode method which properly handles Firebase
		try {
			const newNode = await (nodesService as any).addNode('project', position);

			// Update the node with project data
			const nodeData = {
				title: project.title,
				status: project.status,
				collaborators: project.collaborators || [],
				website: ''
			};

			// Update the node with the synced data
			await nodesService.updateNode(newNode.id, {
				data: {
					...newNode.data,
					nodeData
				}
			});
		} catch (error) {
			console.error('Failed to create synced project node:', error);
		}
	}

	async function syncProjectNode() {
		if (!projectSlug || !projectsService) return;

		let project: any;
		try {
			const projectResult = projectsService.getProject(projectSlug);
			project = projectResult instanceof Promise ? await projectResult : projectResult;
		} catch (error) {
			console.error('Failed to load project for sync:', error);
			return;
		}

		if (!project) return;

		// Find ALL project nodes and sync them
		const projectNodes = nodes.filter((node) => node.data.templateType === 'project');

		for (const node of projectNodes) {
			const currentTitle = (node.data.nodeData as any)?.title;
			const currentStatus = (node.data.nodeData as any)?.status;

			// Only update if title or status has changed
			if (currentTitle !== (project as any).title || currentStatus !== (project as any).status) {
				try {
					await nodesService.updateNode(node.id, {
						data: {
							...node.data,
							nodeData: {
								...(node.data.nodeData || {}),
								title: (project as any).title,
								status: (project as any).status,
								collaborators: (project as any).collaborators || []
							}
						}
					});
				} catch (error) {
					console.error(`Failed to sync project node ${node.id}:`, error);
				}
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
	<div class="relative flex-1" onclick={handleCanvasClick}>
		<!-- Floating Toolbar -->
		<Toolbar view="project" onCreateNode={handleToolbarCreateNode} />
		<SvelteFlow
			class="bg-black"
			bind:nodes
			bind:edges
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

	<!-- Node Task Sidebar -->
	{#if showNodeTaskSidebar}
		<NodeTaskSidebar
			nodeId={taskSidebarNodeId}
			nodeTitle={taskSidebarNodeTitle}
			{projectSlug}
			tasks={taskSidebarTasks}
			onClose={() => {
				// Clean up subscription when closing
				if (taskSubscriptionCleanup) {
					taskSubscriptionCleanup();
					taskSubscriptionCleanup = null;
				}
				showNodeTaskSidebar = false;
			}}
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

{#if showTaskModal}
	<TaskModal
		nodeId={taskModalNodeId}
		{projectSlug}
		task={taskModalTask}
		onClose={() => (showTaskModal = false)}
		onTaskAdded={handleTaskModalComplete}
		onTaskUpdated={handleTaskModalComplete}
	/>
{/if}
