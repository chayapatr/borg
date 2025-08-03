import { 
	collection, 
	doc, 
	addDoc, 
	updateDoc, 
	deleteDoc, 
	getDocs, 
	onSnapshot,
	writeBatch,
	query,
	orderBy,
	type Unsubscribe 
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Node, Edge } from '@xyflow/svelte';
import type { INodesService } from '../interfaces/INodesService';
import { getTemplate } from '../../templates';

export class FirebaseNodesService implements INodesService {
	private projectId: string;
	private setNodes: (nodes: Node[]) => void;
	private getNodes: () => Node[];
	private setEdges: (edges: Edge[]) => void;
	private getEdges: () => Edge[];
	private projectSlug?: string;

	constructor(
		projectId: string,
		setNodes: (nodes: Node[]) => void,
		getNodes: () => Node[],
		setEdges: (edges: Edge[]) => void,
		getEdges: () => Edge[],
		projectSlug?: string
	) {
		this.projectId = projectId;
		this.setNodes = setNodes;
		this.getNodes = getNodes;
		this.setEdges = setEdges;
		this.getEdges = getEdges;
		this.projectSlug = projectSlug;
	}

	async addNode(templateType: string, position: { x: number; y: number }): Promise<Node> {
		const template = getTemplate(templateType);
		const id = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

		// Initialize default data based on template
		const nodeDataFields: Record<string, any> = {};
		template.fields.forEach((field) => {
			if (field.type === 'tags') {
				nodeDataFields[field.id] = [];
			} else {
				nodeDataFields[field.id] = '';
			}
		});

		const newNode: Node = {
			id,
			type: 'universal',
			position: { ...position },
			data: {
				templateType: templateType,
				nodeData: nodeDataFields,
				projectSlug: this.projectSlug
			}
		};

		// Save to Firestore
		const nodeDoc = {
			id: newNode.id,
			type: newNode.type,
			position: newNode.position,
			data: this.filterUndefinedValues(newNode.data),
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		await addDoc(collection(db, 'projects', this.projectId, 'nodes'), nodeDoc);

		// Update local state
		const currentNodes = this.getNodes();
		const updatedNodes = [...currentNodes, newNode];
		this.setNodes(updatedNodes);

		return newNode;
	}

	async updateNode(nodeId: string, updates: any, userId?: string): Promise<boolean> {
		try {
			const nodeRef = doc(db, 'projects', this.projectId, 'nodes', nodeId);
			
			// Filter out undefined values recursively
			const filteredUpdates = this.filterUndefinedValues(updates);

			await updateDoc(nodeRef, {
				...filteredUpdates,
				updatedAt: new Date().toISOString(),
				...(userId && { updatedBy: userId })
			});

			// Update local state
			const updatedNodes = this.getNodes().map((node) =>
				node.id === nodeId ? { ...node, ...updates } : node
			);
			this.setNodes(updatedNodes);

			return true;
		} catch (error) {
			console.error('Failed to update node:', error);
			return false;
		}
	}

	async deleteNode(nodeId: string): Promise<boolean> {
		try {
			// Delete from Firestore
			const nodeRef = doc(db, 'projects', this.projectId, 'nodes', nodeId);
			await deleteDoc(nodeRef);

			// Update local state
			const updatedNodes = this.getNodes().filter((node) => node.id !== nodeId);
			this.setNodes(updatedNodes);

			// Also remove any edges connected to this node
			const updatedEdges = this.getEdges().filter(
				(edge) => edge.source !== nodeId && edge.target !== nodeId
			);
			this.setEdges(updatedEdges);

			// Delete connected edges from Firestore
			const edgesCollection = collection(db, 'projects', this.projectId, 'edges');
			const edgesSnapshot = await getDocs(edgesCollection);
			const batch = writeBatch(db);

			edgesSnapshot.docs.forEach((edgeDoc) => {
				const edgeData = edgeDoc.data();
				if (edgeData.source === nodeId || edgeData.target === nodeId) {
					batch.delete(edgeDoc.ref);
				}
			});

			await batch.commit();

			return true;
		} catch (error) {
			console.error('Failed to delete node:', error);
			return false;
		}
	}

	async getNodes(): Promise<Node[]> {
		try {
			const nodesCollection = collection(db, 'projects', this.projectId, 'nodes');
			const snapshot = await getDocs(nodesCollection);
			return snapshot.docs.map(doc => {
				const data = doc.data();
				return {
					id: data.id,
					type: data.type,
					position: data.position,
					data: data.data
				} as Node;
			});
		} catch (error) {
			console.error('Failed to get nodes:', error);
			return [];
		}
	}

	async addEdge(edgeData: Edge): Promise<Edge> {
		// Save to Firestore
		const edgeDoc = {
			...edgeData,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		await addDoc(collection(db, 'projects', this.projectId, 'edges'), edgeDoc);

		// Update local state
		const updatedEdges = [...this.getEdges(), edgeData];
		this.setEdges(updatedEdges);

		return edgeData;
	}

	async deleteEdge(edgeId: string): Promise<boolean> {
		try {
			// Find and delete from Firestore
			const edgesCollection = collection(db, 'projects', this.projectId, 'edges');
			const snapshot = await getDocs(edgesCollection);
			
			const edgeDoc = snapshot.docs.find(doc => doc.data().id === edgeId);
			if (edgeDoc) {
				await deleteDoc(edgeDoc.ref);
			}

			// Update local state
			const updatedEdges = this.getEdges().filter((edge) => edge.id !== edgeId);
			this.setEdges(updatedEdges);

			return true;
		} catch (error) {
			console.error('Failed to delete edge:', error);
			return false;
		}
	}

	async getEdges(): Promise<Edge[]> {
		try {
			const edgesCollection = collection(db, 'projects', this.projectId, 'edges');
			const snapshot = await getDocs(edgesCollection);
			return snapshot.docs.map(doc => doc.data() as Edge);
		} catch (error) {
			console.error('Failed to get edges:', error);
			return [];
		}
	}

	async saveBatch(nodes: Node[], edges: Edge[]): Promise<void> {
		try {
			const batch = writeBatch(db);

			// Save all nodes
			nodes.forEach(node => {
				const nodeDoc = {
					id: node.id,
					type: node.type,
					position: node.position,
					data: this.filterUndefinedValues(node.data),
					updatedAt: new Date().toISOString()
				};
				const nodeRef = doc(collection(db, 'projects', this.projectId, 'nodes'));
				batch.set(nodeRef, nodeDoc);
			});

			// Save all edges
			edges.forEach(edge => {
				const edgeDoc = this.filterUndefinedValues({
					...edge,
					updatedAt: new Date().toISOString()
				});
				const edgeRef = doc(collection(db, 'projects', this.projectId, 'edges'));
				batch.set(edgeRef, edgeDoc);
			});

			await batch.commit();
		} catch (error) {
			console.error('Failed to save batch:', error);
		}
	}

	// Helper method to recursively filter out undefined values
	private filterUndefinedValues(obj: any): any {
		if (obj === null || typeof obj !== 'object') {
			return obj;
		}

		if (Array.isArray(obj)) {
			return obj.map(item => this.filterUndefinedValues(item));
		}

		const filtered: any = {};
		for (const [key, value] of Object.entries(obj)) {
			if (value !== undefined) {
				filtered[key] = this.filterUndefinedValues(value);
			}
		}
		return filtered;
	}

	subscribeToNodes(callback: (nodes: Node[]) => void): () => void {
		const nodesCollection = collection(db, 'projects', this.projectId, 'nodes');
		const q = query(nodesCollection, orderBy('updatedAt', 'desc'));

		const unsubscribe = onSnapshot(q, (snapshot) => {
			const nodes = snapshot.docs.map(doc => {
				const data = doc.data();
				return {
					id: data.id,
					type: data.type,
					position: data.position,
					data: data.data
				} as Node;
			});
			
			this.setNodes(nodes);
			callback(nodes);
		});

		return unsubscribe;
	}

	subscribeToEdges(callback: (edges: Edge[]) => void): () => void {
		const edgesCollection = collection(db, 'projects', this.projectId, 'edges');
		const q = query(edgesCollection, orderBy('updatedAt', 'desc'));

		const unsubscribe = onSnapshot(q, (snapshot) => {
			const edges = snapshot.docs.map(doc => doc.data() as Edge);
			
			this.setEdges(edges);
			callback(edges);
		});

		return unsubscribe;
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
}