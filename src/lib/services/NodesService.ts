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
				nodeData
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
					this.setNodes(data.nodes);
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
