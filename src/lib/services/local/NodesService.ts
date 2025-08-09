import type { Node, Edge } from '@xyflow/svelte';
import { getTemplate } from '../../templates';
import { ProjectsService } from './ProjectsService';
import { ServiceFactory } from '../ServiceFactory';

export class NodesService {
	private storageKey: string;
	private projectsService: ProjectsService;

	constructor(
		private setNodes: (nodes: Node[]) => void,
		private getNodes: () => Node[],
		private setEdges: (edges: Edge[]) => void,
		private getEdges: () => Edge[],
		private projectSlug?: string
	) {
		this.storageKey = projectSlug 
			? `things-canvas-data-${projectSlug}` 
			: 'things-canvas-data';
		this.projectsService = new ProjectsService();
	}

	addNode(templateType: string, position: { x: number; y: number }): Node {
		const template = getTemplate(templateType);
		const id = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

		// Initialize default data based on template
		const nodeData: Record<string, any> = {};
		template.fields.forEach((field) => {
			if (field.type === 'tags') {
				nodeData[field.id] = [];
			} else if (field.type === 'select' && templateType === 'note') {
				// Set defaults for note sizing - current behavior is small size
				if (field.id === 'size') {
					nodeData[field.id] = 'Small';
				} else {
					nodeData[field.id] = '';
				}
			} else {
				nodeData[field.id] = '';
			}
		});

		const newNode: Node = {
			id,
			type: 'universal',
			position: { ...position }, // Ensure clean position object
			data: {
				templateType,
				nodeData,
				projectSlug: this.projectSlug // Add project slug for task loading
			}
		};

		// Simply add to existing array - binding will handle reactivity
		const currentNodes = this.getNodes();
		const updatedNodes = [...currentNodes, newNode];
		this.setNodes(updatedNodes);
		this.saveToStorage(updatedNodes, this.getEdges());
		
		return newNode;
	}

	updateNode(nodeId: string, data: any, userId?: string): boolean {
		const oldNodes = this.getNodes();
		const oldNode = oldNodes.find(n => n.id === nodeId);
		const oldStatus = oldNode?.data?.nodeData?.status;
		
		const updatedNodes = oldNodes.map((node) =>
			node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
		);
		
		this.setNodes(updatedNodes);
		this.saveToStorage(updatedNodes, this.getEdges());
		
		// Check if status changed and invalidate cache if needed
		const newNode = updatedNodes.find(n => n.id === nodeId);
		const newStatus = newNode?.data?.nodeData?.status;
		
		if (oldStatus !== newStatus && this.projectSlug) {
			this.projectsService.invalidateStatusCache(this.projectSlug);
		}

		// Refresh task titles to reflect any node title/type changes
		try {
			const taskService = ServiceFactory.createTaskService();
			if (taskService.refreshNodeTitles) {
				taskService.refreshNodeTitles();
				console.log('Task titles refreshed after node update');
			}
		} catch (error) {
			console.warn('Failed to refresh task titles after node update:', error);
		}
		
		return true;
	}

	deleteNode(nodeId: string): boolean {
		const updatedNodes = this.getNodes().filter((node) => node.id !== nodeId);
		this.setNodes(updatedNodes);

		// Also remove any edges connected to this node
		const updatedEdges = this.getEdges().filter(
			(edge) => edge.source !== nodeId && edge.target !== nodeId
		);
		this.setEdges(updatedEdges);
		this.saveToStorage(updatedNodes, updatedEdges);
		
		return true;
	}

	addEdge(edge: Edge): Edge {
		const updatedEdges = [...this.getEdges(), edge];
		this.setEdges(updatedEdges);
		this.saveToStorage(this.getNodes(), updatedEdges);
		
		return edge;
	}

	deleteEdge(edgeId: string): boolean {
		const updatedEdges = this.getEdges().filter((edge) => edge.id !== edgeId);
		this.setEdges(updatedEdges);
		this.saveToStorage(this.getNodes(), updatedEdges);
		
		return true;
	}

	saveBatch(nodes: Node[], edges: Edge[]): void {
		this.setNodes(nodes);
		this.setEdges(edges);
		this.saveToStorage(nodes, edges);
	}

	getStatusCounts(): { todo: number; doing: number; done: number } {
		const nodes = this.getNodes();
		const counts = { todo: 0, doing: 0, done: 0 };
		
		nodes.forEach(node => {
			const status = node.data?.nodeData?.status;
			if (status === 'To Do') {
				counts.todo++;
			} else if (status === 'Doing') {
				counts.doing++;
			} else if (status === 'Done') {
				counts.done++;
			}
		});
		
		return counts;
	}


	saveToStorage(nodes: Node[], edges: Edge[]) {
		try {
			const data = { nodes, edges };
			localStorage.setItem(this.storageKey, JSON.stringify(data));
		} catch (error) {
			console.error('Failed to save to localStorage:', error);
		}
	}

	loadFromStorage() {
		try {
			const stored = localStorage.getItem(this.storageKey);
			if (stored) {
				const data = JSON.parse(stored);
				if (data.nodes) {
					// Add projectSlug to node data and ensure backward compatibility
					const nodesWithProjectSlug = data.nodes.map((node: any) => ({
						...node,
						data: {
							...node.data,
							projectSlug: this.projectSlug, // Add project slug for task loading
							// Remove tasks array since they're now stored separately
							tasks: undefined
						}
					}));
					this.setNodes(nodesWithProjectSlug);
				}
				if (data.edges) {
					this.setEdges(data.edges);
				}
			}
		} catch (error) {
			console.error('Failed to load from localStorage:', error);
		}
	}

	clearStorage() {
		try {
			localStorage.removeItem(this.storageKey);
			this.setNodes([]);
			this.setEdges([]);
		} catch (error) {
			console.error('Failed to clear localStorage:', error);
		}
	}
}
