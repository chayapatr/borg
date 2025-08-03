import type { Node, Edge } from '@xyflow/svelte';

export interface INodesService {
	addNode(templateType: string, position: { x: number; y: number }): Promise<Node> | Node;
	updateNode(nodeId: string, updates: any, userId?: string): Promise<boolean> | boolean;
	deleteNode(nodeId: string): Promise<boolean> | boolean;
	getNodes(): Promise<Node[]> | Node[];
	addEdge(edgeData: Edge): Promise<Edge> | Edge;
	deleteEdge(edgeId: string): Promise<boolean> | boolean;
	getEdges(): Promise<Edge[]> | Edge[];
	saveBatch(nodes: Node[], edges: Edge[]): Promise<void> | void;
	saveBatchOptimized?(nodes: Node[], edges: Edge[], previousNodes?: Node[], previousEdges?: Edge[]): Promise<void> | void;

	// localStorage specific methods
	loadFromStorage?(): void;
	saveToStorage?(): void;

	// Real-time subscriptions (Firebase only)
	subscribeToNodes?(callback: (nodes: Node[]) => void): () => void;
	subscribeToEdges?(callback: (edges: Edge[]) => void): () => void;
}