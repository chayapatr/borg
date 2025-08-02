import type { Node, Edge } from '@xyflow/svelte';
import { getTemplate } from '../templates';

export class NodesService {
	private storageKey: string;

	constructor(
		private setNodes: (nodes: Node[]) => void,
		private getNodes: () => Node[],
		private setEdges: (edges: Edge[]) => void,
		private getEdges: () => Edge[],
		projectSlug?: string
	) {
		this.storageKey = projectSlug 
			? `things-canvas-data-${projectSlug}` 
			: 'things-canvas-data';
	}

	addNode(templateType: string, position: { x: number; y: number }) {
		const template = getTemplate(templateType);
		const id = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

		// Initialize default data based on template
		const nodeData: Record<string, any> = {};
		template.fields.forEach((field) => {
			if (field.type === 'tags') {
				nodeData[field.id] = [];
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
				tasks: [] // Initialize empty tasks array
			}
		};

		// Simply add to existing array - binding will handle reactivity
		const currentNodes = this.getNodes();
		const updatedNodes = [...currentNodes, newNode];
		this.setNodes(updatedNodes);
		this.saveToStorage(updatedNodes, this.getEdges());
	}

	updateNode(nodeId: string, data: any) {
		const updatedNodes = this.getNodes().map((node) =>
			node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
		);
		this.setNodes(updatedNodes);
		this.saveToStorage(updatedNodes, this.getEdges());
	}

	deleteNode(nodeId: string) {
		const updatedNodes = this.getNodes().filter((node) => node.id !== nodeId);
		this.setNodes(updatedNodes);

		// Also remove any edges connected to this node
		const updatedEdges = this.getEdges().filter(
			(edge) => edge.source !== nodeId && edge.target !== nodeId
		);
		this.setEdges(updatedEdges);
		this.saveToStorage(updatedNodes, updatedEdges);
	}

	addEdge(edge: Edge) {
		const updatedEdges = [...this.getEdges(), edge];
		this.setEdges(updatedEdges);
		this.saveToStorage(this.getNodes(), updatedEdges);
	}

	deleteEdge(edgeId: string) {
		const updatedEdges = this.getEdges().filter((edge) => edge.id !== edgeId);
		this.setEdges(updatedEdges);
		this.saveToStorage(this.getNodes(), updatedEdges);
	}

	getStatusCounts(): { todo: number; doing: number; done: number } {
		const nodes = this.getNodes();
		const counts = { todo: 0, doing: 0, done: 0 };
		
		nodes.forEach(node => {
			const status = node.data?.nodeData?.status?.toLowerCase();
			if (status === 'to do') {
				counts.todo++;
			} else if (status === 'doing') {
				counts.doing++;
			} else if (status === 'done') {
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
					// Ensure backward compatibility - add tasks array if missing
					const nodesWithTasks = data.nodes.map((node: any) => ({
						...node,
						data: {
							...node.data,
							tasks: node.data.tasks || []
						}
					}));
					this.setNodes(nodesWithTasks);
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
