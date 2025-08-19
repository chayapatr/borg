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
	import UniversalNode from './UniversalNode/UniversalNode.svelte';
	import NoteNode from './UniversalNode/NoteNode.svelte';
	import StickerNode from './UniversalNode/StickerNode.svelte';
	import { ServiceFactory } from '../services/ServiceFactory';
	import type { INodesService, IProjectsService, ITaskService } from '../services/interfaces';
	import CreateNodeModal from './CreateNodeModal.svelte';
	import EditPanel from './EditPanel.svelte';
	import NodeTaskSidebar from './tasks/NodeTaskSidebar.svelte';
	import TaskModal from './tasks/TaskModal.svelte';
	import Toolbar from './Toolbar.svelte';
	import StickerPanel from './stickers/StickerPanel.svelte';
	import type { Task } from '../types/task';
	import { authStore } from '../stores/authStore';
	import '@xyflow/svelte/dist/style.css';
	import './svelteflow.css';

	let { projectSlug, onProjectUpdate } = $props<{
		projectSlug?: string;
		onProjectUpdate?: () => void;
	}>();

	const nodeTypes = {
		universal: UniversalNode
	};

	// Add editing state to nodes and handle lock state without recreating objects to preserve positions
	$effect(() => {
		if (nodes.length > 0) {
			nodes.forEach((node) => {
				if (node.data) {
					node.data.isBeingEdited = showEditPanel && editNodeId === node.id;
					// Set draggable property based on lock state - locked nodes can't be dragged
					node.draggable = !(node.data.nodeData && node.data.nodeData.locked);
				}
			});
		}
	});

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

	// Sticker panel state
	let showStickerPanel = $state(false);

	// Flag to prevent redundant auto-saves after explicit saves
	let skipNextAutoSave = $state(false);

	// Project sync optimization
	let lastProjectSyncTime = 0;
	let lastKnownProjectData: any = null;
	const PROJECT_SYNC_DEBOUNCE = 5000; // 5 seconds

	// Get Svelte Flow helpers
	const { screenToFlowPosition, getViewport, setViewport } = useSvelteFlow();

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
	// but SKIP if nodes were just added/removed (handled by Firestore subscriptions)
	$effect(() => {
		if (nodesService && nodes.length > 0 && previousNodes.length > 0) {
			// Only trigger auto-save if this is likely a position/content change, not add/remove
			const nodeCountChanged = nodes.length !== previousNodes.length;
			if (nodeCountChanged) {
				// Node was added/removed - don't auto-save as Firestore already has the data
				// Just update our tracking arrays
				previousNodes = [...nodes];
				previousEdges = [...edges];
				return;
			}

			// Check if this is a position change (from dragging) - save immediately
			let hasPositionChanges = false;
			if (previousNodes.length === nodes.length) {
				for (let i = 0; i < nodes.length; i++) {
					const current = nodes[i];
					const previous = previousNodes.find((p) => p.id === current.id);
					if (
						previous &&
						(current.position.x !== previous.position.x ||
							current.position.y !== previous.position.y)
					) {
						hasPositionChanges = true;
						break;
					}
				}
			}

			clearTimeout(saveTimeout);

			// Use shorter timeout for position changes to prevent Firebase conflicts
			const timeout = hasPositionChanges ? 100 : 500;

			saveTimeout = setTimeout(async () => {
				// Skip auto-save if we just did an explicit save
				if (skipNextAutoSave) {
					skipNextAutoSave = false;
					return;
				}

				console.log(
					`Canvas: Auto-saving (hasPositionChanges: ${hasPositionChanges}, timeout: ${timeout}ms)`
				);

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

				// Update project node count if we have a project (debounced)
				if (projectSlug && projectsService) {
					await projectsService.updateNodeCount(projectSlug, nodes.length);
				}
			}, timeout);
		}
	});

	// Removed duplicate node count update - handled in auto-save effect above

	// Optimized project sync - only when actually needed
	$effect(() => {
		if (projectSlug && projectsService && nodes.length > 0) {
			// Much longer interval since project data rarely changes
			const interval = setInterval(() => {
				checkAndSyncProjectNode();
			}, 10000); // Check every 10 seconds instead of 1 second

			return () => clearInterval(interval);
		}
	});

	// Viewport saving with debounce
	let viewportSaveTimeout: ReturnType<typeof setTimeout>;
	const VIEWPORT_SAVE_DELAY = 100; // Save after 500ms of inactivity

	// Functions for viewport position management
	async function saveViewportPosition() {
		if (!projectSlug || !projectsService) return;

		// Get current user ID
		const currentUser = $authStore.user;
		if (!currentUser) {
			console.log('Canvas: No user logged in, cannot save viewport');
			return;
		}

		try {
			const viewport = getViewport();
			const viewportData = {
				x: viewport.x,
				y: viewport.y,
				zoom: viewport.zoom
			};

			// Get existing project data to preserve existing viewport positions
			const projectResult = projectsService.getProject(projectSlug);
			const project = projectResult instanceof Promise ? await projectResult : projectResult;

			// Get existing viewport positions object, or create new one
			const existingViewportPositions = (project as any)?.viewportPositions || {};

			// Update viewport position for current user
			const updatedViewportPositions = {
				...existingViewportPositions,
				[currentUser.uid]: viewportData
			};

			// Save to Firebase using projects service
			await projectsService.updateProject(projectSlug, {
				viewportPositions: updatedViewportPositions
			} as any);
			console.log('Canvas: Saved viewport position for user:', currentUser.uid, viewportData);
		} catch (error) {
			console.error('Canvas: Failed to save viewport position:', error);
		}
	}

	function debouncedSaveViewport() {
		clearTimeout(viewportSaveTimeout);
		viewportSaveTimeout = setTimeout(() => {
			// saveViewportPosition();
		}, VIEWPORT_SAVE_DELAY);
	}

	async function loadViewportPosition() {
		if (!projectSlug || !projectsService) return;

		// Get current user ID
		const currentUser = $authStore.user;
		if (!currentUser) {
			console.log('Canvas: No user logged in, cannot load viewport');
			return;
		}

		try {
			const projectResult = projectsService.getProject(projectSlug);
			const project = projectResult instanceof Promise ? await projectResult : projectResult;

			// Check for user-specific viewport position
			const userViewportPosition = (project as any)?.viewportPositions?.[currentUser.uid];

			if (userViewportPosition) {
				const { x, y, zoom } = userViewportPosition;
				// Use setTimeout to ensure SvelteFlow is fully mounted
				setTimeout(() => {
					setViewport({ x, y, zoom }, { duration: 0 });
					console.log(
						'Canvas: Restored viewport position for user:',
						currentUser.uid,
						userViewportPosition
					);
				}, 0);
			} else {
				console.log('Canvas: No saved viewport position found for user:', currentUser.uid);
			}
		} catch (error) {
			console.error('Canvas: Failed to load viewport position:', error);
		}
	}

	// Handle viewport move events
	function handleViewportChange() {
		// Save position when user moves the viewport (debounced)
		debouncedSaveViewport();
	}

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

			// Load and restore viewport position
			// await loadViewportPosition();

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
			// Close other panels if open to avoid conflicts
			showNodeTaskSidebar = false;
			showStickerPanel = false;
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

			// Close other panels if open to avoid conflicts
			showEditPanel = false;
			showStickerPanel = false;
		};

		const handleAddTaskEvent = (event: CustomEvent) => {
			taskModalNodeId = event.detail.nodeId;
			taskModalTask = undefined; // undefined = add mode
			showTaskModal = true;
		};

		const handleAddStickerEvent = (event: CustomEvent) => {
			handleAddSticker(event);
		};

		document.addEventListener('nodeDelete', handleNodeDeleteEvent as EventListener);
		document.addEventListener('nodeUpdate', handleNodeUpdateEvent as EventListener);
		document.addEventListener('nodeEdit', handleNodeEditEvent as EventListener);
		document.addEventListener('nodeTasksOpen', handleNodeTasksOpenEvent as EventListener);
		document.addEventListener('addTask', handleAddTaskEvent as EventListener);
		document.addEventListener('addSticker', handleAddStickerEvent as EventListener);

		return () => {
			document.removeEventListener('nodeDelete', handleNodeDeleteEvent as EventListener);
			document.removeEventListener('nodeUpdate', handleNodeUpdateEvent as EventListener);
			document.removeEventListener('nodeEdit', handleNodeEditEvent as EventListener);
			document.removeEventListener('nodeTasksOpen', handleNodeTasksOpenEvent as EventListener);
			document.removeEventListener('addTask', handleAddTaskEvent as EventListener);
			document.removeEventListener('addSticker', handleAddStickerEvent as EventListener);

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

	function handleShowStickers() {
		console.log('🎨 handleShowStickers called, current state:', showStickerPanel);
		// Close other drawers/panels when opening sticker panel
		showEditPanel = false;
		showNodeTaskSidebar = false;
		showStickerPanel = true;
		console.log('🎨 showStickerPanel set to:', showStickerPanel);
	}

	// Handle add sticker event (click-based)
	async function handleAddSticker(event: CustomEvent) {
		console.log('🎨 Canvas received add sticker event:', event.detail);

		if (!nodesService) return;

		try {
			const stickerData = event.detail;

			if (stickerData.type === 'sticker') {
				// Create sticker at center of viewport
				const position = getViewportCenterPosition();

				// First create a basic sticker node using the service
				const baseNode = await (nodesService as any).addNode('sticker', position);
				console.log('🎨 Created base sticker node:', baseNode);

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

				const success = await (nodesService as any).updateNode(baseNode.id, {
					nodeData: stickerNodeData
				});

				if (success) {
					console.log('✅ Sticker node created and updated with data');
				} else {
					console.error('❌ Failed to update sticker node with data');
				}
			}
		} catch (error) {
			console.error('❌ Failed to add sticker:', error);
		}
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
		skipNextAutoSave = true; // Skip the next auto-save since we just did an explicit save

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

			// Include node count in the same update to batch requests
			updates.nodeCount = nodes.length;

			if (Object.keys(updates).length > 1) {
				// More than just nodeCount
				projectsService.updateProject(projectSlug, updates);
			}
		}

		// Notify parent component to refresh project data if status changed
		if (hasStatusChange && onProjectUpdate) {
			onProjectUpdate();
		}
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
			const draggedNode = nodes.find((node) => node.id === draggedNodeId);
			const otherNodes = nodes.filter((node) => node.id !== draggedNodeId);

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
		console.log('Event details:', {
			node: event?.node,
			targetNode: event?.targetNode,
			eventType: typeof event
		});
		console.log(
			'Current nodes state:',
			nodes.map((n) => ({ id: n.id, position: n.position, templateType: n.data?.templateType }))
		);

		if (nodesService) {
			// Single atomic save - use optimized batch save if available
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
							// Update previous state and skip next auto-save
							previousNodes = [...nodes];
							previousEdges = [...edges];
							skipNextAutoSave = true;
						})
						.catch((error) => {
							console.error('Failed to save positions after drag:', error);
						});
				} else {
					// Update previous state and skip next auto-save
					previousNodes = [...nodes];
					previousEdges = [...edges];
					skipNextAutoSave = true;
				}
			} else if (nodesService.saveBatch) {
				const result = nodesService.saveBatch(nodes, edges);
				if (result instanceof Promise) {
					result
						.then(() => {
							console.log('Positions saved after drag');
							// Update previous state and skip next auto-save
							previousNodes = [...nodes];
							previousEdges = [...edges];
							skipNextAutoSave = true;
						})
						.catch((error) => {
							console.error('Failed to save positions after drag:', error);
						});
				} else {
					// Update previous state and skip next auto-save
					previousNodes = [...nodes];
					previousEdges = [...edges];
					skipNextAutoSave = true;
				}
			}
		}

		// Removed individual node position save to prevent triple saves
		// The batch save above handles all position updates atomically
	}

	// Function to refresh task sidebar data only (no global event spam)
	async function handleTasksUpdated() {
		console.log('Canvas: handleTasksUpdated called - refreshing sidebar only');

		// Only refresh the sidebar if it's open - no global event spam
		if (showNodeTaskSidebar && taskSidebarNodeId && taskService) {
			console.log('Canvas: Refreshing sidebar tasks for node:', taskSidebarNodeId);
			const tasksResult = taskService.getNodeTasks(taskSidebarNodeId, projectSlug);
			const updatedTasks = tasksResult instanceof Promise ? await tasksResult : tasksResult;
			console.log('Canvas: Updated sidebar tasks:', updatedTasks.length);
			taskSidebarTasks = [...updatedTasks];
		}

		// For localStorage services only - refresh storage data
		if (nodesService.loadFromStorage) {
			nodesService.loadFromStorage();
		}
		// Firebase services handle updates via subscriptions automatically
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

	// Optimized project sync that only runs when project data actually changes
	async function checkAndSyncProjectNode() {
		if (!projectSlug || !projectsService) return;

		const now = Date.now();
		if (now - lastProjectSyncTime < PROJECT_SYNC_DEBOUNCE) {
			return; // Skip if we synced recently
		}

		let project: any;
		try {
			const projectResult = projectsService.getProject(projectSlug);
			project = projectResult instanceof Promise ? await projectResult : projectResult;
		} catch (error) {
			console.error('Failed to load project for sync check:', error);
			return;
		}

		if (!project) return;

		// Check if project data actually changed
		const projectDataString = JSON.stringify({
			title: project.title,
			status: project.status,
			collaborators: project.collaborators
		});

		if (lastKnownProjectData === projectDataString) {
			return; // No changes, skip sync
		}

		console.log('Project data changed, syncing nodes...');
		lastKnownProjectData = projectDataString;
		lastProjectSyncTime = now;

		await syncProjectNode(project);
	}

	async function syncProjectNode(project?: any) {
		if (!projectSlug || !projectsService) return;

		// Get project data if not provided
		if (!project) {
			try {
				const projectResult = projectsService.getProject(projectSlug);
				project = projectResult instanceof Promise ? await projectResult : projectResult;
			} catch (error) {
				console.error('Failed to load project for sync:', error);
				return;
			}
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
		<Toolbar
			view="project"
			onCreateNode={handleToolbarCreateNode}
			onShowStickers={handleShowStickers}
		/>
		<div class="h-full w-full">
			<SvelteFlow
				class="bg-black"
				bind:nodes
				bind:edges
				{nodeTypes}
				fitView
				onconnect={handleConnect}
				onbeforedelete={handleBeforeDelete}
				ondelete={handleDelete}
				onnodedragstart={handleNodeDragStart}
				onnodedragstop={handleNodeDragStop}
				onmoveend={handleViewportChange}
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

	<!-- Sticker Panel -->
	{#if showStickerPanel}
		<StickerPanel bind:isOpen={showStickerPanel} onClose={() => (showStickerPanel = false)} />
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
