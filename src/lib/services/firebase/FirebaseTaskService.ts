import { 
	collection, 
	addDoc, 
	deleteDoc, 
	getDocs, 
	getDoc,
	query, 
	where, 
	orderBy, 
	onSnapshot,
	updateDoc,
	doc,
	writeBatch,
	type Unsubscribe 
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Task, TaskWithContext, TaskCounts, PersonTaskCount } from '../../types/task';
import type { ITaskService } from '../interfaces';
import { get } from 'svelte/store';
import { authStore } from '../../stores/authStore';

export interface StoredTask {
	id: string;
	title: string;
	assignee: string;
	dueDate: string;
	notes: string;
	createdAt: string;
	status?: 'active' | 'resolved';
	projectId: string;
	projectSlug: string;
	projectTitle: string;
	nodeId: string;
	nodeTitle: string;
	nodeType: string;
	createdBy: string;
	isOverdue: boolean;
}

export class FirebaseTaskService implements ITaskService {
	// Get the correct title field name based on template type
	private getTitleFieldName(templateType?: string): string {
		switch (templateType) {
			case 'note':
				return 'content';
			case 'time':
				return 'event'; // This will need special handling as it's a timeline-selector
			default:
				return 'title';
		}
	}

	// Extract title from node data based on template type
	private extractNodeTitle(nodeData: any, templateType?: string): string {
		if (!nodeData) {
			console.log('FirebaseTaskService.extractNodeTitle: nodeData is null/undefined');
			return 'Untitled';
		}
		
		const titleField = this.getTitleFieldName(templateType);
		const titleValue = nodeData[titleField];
		
		console.log('FirebaseTaskService.extractNodeTitle:', {
			templateType,
			titleField,
			titleValue,
			nodeData: Object.keys(nodeData),
			availableFields: Object.entries(nodeData).map(([k, v]) => `${k}: ${typeof v === 'string' ? v.substring(0, 50) : typeof v}`)
		});
		
		if (!titleValue) {
			// Try fallback fields if primary field is empty
			const fallbackFields = ['title', 'content', 'name'];
			for (const field of fallbackFields) {
				if (nodeData[field] && typeof nodeData[field] === 'string' && nodeData[field].trim()) {
					console.log(`FirebaseTaskService.extractNodeTitle: Using fallback field '${field}': ${nodeData[field]}`);
					return nodeData[field];
				}
			}
			console.log('FirebaseTaskService.extractNodeTitle: No valid title found, returning Untitled');
			return 'Untitled';
		}
		
		// For timeline-selector fields, we need to handle them differently
		if (templateType === 'time' && titleField === 'event') {
			// This would need timeline service to resolve the event title
			// For now, return a placeholder
			return titleValue ? `Timeline Event` : 'Untitled';
		}
		
		return titleValue;
	}

	async getAllTasks(): Promise<TaskWithContext[]> {
		const q = query(
			collection(db, 'tasks'),
			where('status', 'in', ['active', null]),
			orderBy('createdAt', 'desc')
		);
		const snapshot = await getDocs(q);
		return snapshot.docs.map(doc => this.toTaskWithContext(doc.data() as StoredTask));
	}

	async getProjectTasks(projectSlug: string): Promise<TaskWithContext[]> {
		const q = query(
			collection(db, 'tasks'),
			where('projectSlug', '==', projectSlug),
			where('status', 'in', ['active', null]),
			orderBy('createdAt', 'desc')
		);
		const snapshot = await getDocs(q);
		return snapshot.docs.map(doc => this.toTaskWithContext(doc.data() as StoredTask));
	}

	async getPersonTasks(personId: string): Promise<TaskWithContext[]> {
		const q = query(
			collection(db, 'tasks'),
			where('assignee', '==', personId),
			where('status', 'in', ['active', null]),
			orderBy('createdAt', 'desc')
		);
		const snapshot = await getDocs(q);
		return snapshot.docs.map(doc => this.toTaskWithContext(doc.data() as StoredTask));
	}

	async getNodeTasks(nodeId: string, projectSlug?: string): Promise<Task[]> {
		let q;
		if (projectSlug) {
			q = query(
				collection(db, 'tasks'),
				where('projectSlug', '==', projectSlug),
				where('nodeId', '==', nodeId),
				where('status', 'in', ['active', null]),
				orderBy('createdAt', 'desc')
			);
		} else {
			q = query(
				collection(db, 'tasks'),
				where('nodeId', '==', nodeId),
				where('status', 'in', ['active', null]),
				orderBy('createdAt', 'desc')
			);
		}

		const snapshot = await getDocs(q);
		return snapshot.docs.map(doc => {
			const data = doc.data() as StoredTask;
			return {
				id: data.id,
				title: data.title,
				assignee: data.assignee,
				dueDate: data.dueDate,
				notes: data.notes,
				createdAt: data.createdAt,
				status: data.status || 'active'
			};
		});
	}

	async getNodePersonTaskCounts(nodeId: string, projectSlug?: string): Promise<PersonTaskCount[]> {
		const tasks = await this.getNodeTasks(nodeId, projectSlug);
		const counts = new Map<string, number>();
		
		tasks.forEach((task) => {
			counts.set(task.assignee, (counts.get(task.assignee) || 0) + 1);
		});

		return Array.from(counts.entries()).map(([personId, count]) => ({
			personId,
			count
		}));
	}

	async addTask(nodeId: string, task: Omit<Task, 'id' | 'createdAt'>, projectSlug?: string): Promise<void> {
		if (!projectSlug) {
			throw new Error('Project slug is required for Firebase task creation');
		}

		// We'll need project and node context - this would typically come from the calling component
		// For now, we'll need to fetch project info
		const projectQuery = query(collection(db, 'projects'), where('slug', '==', projectSlug));
		const projectSnapshot = await getDocs(projectQuery);
		
		if (projectSnapshot.empty) {
			throw new Error(`Project not found: ${projectSlug}`);
		}

		const projectData = projectSnapshot.docs[0].data();
		const project = { id: projectSnapshot.docs[0].id, title: projectData.title || 'Untitled Project', ...projectData };
		
		// Get node info - use document ID directly instead of querying by field
		console.log('FirebaseTaskService.addTask: Looking for node:', { projectId: project.id, nodeId });
		
		let nodeData = null;
		try {
			const nodeDocRef = doc(db, 'projects', project.id, 'nodes', nodeId);
			const nodeSnapshot = await getDoc(nodeDocRef);
			
			console.log('FirebaseTaskService.addTask: Node query results:', { 
				exists: nodeSnapshot.exists()
			});
			
			nodeData = nodeSnapshot.exists() ? nodeSnapshot.data() : null;
		} catch (error) {
			console.warn('FirebaseTaskService.addTask: Error getting node:', error);
			nodeData = null;
		}
		console.log('FirebaseTaskService.addTask: Retrieved node data:', {
			nodeData: nodeData ? Object.keys(nodeData) : 'null',
			hasNodeData: !!nodeData?.nodeData,
			templateType: nodeData?.templateType,
			nodeDataKeys: nodeData?.nodeData ? Object.keys(nodeData.nodeData) : 'none',
			rawNodeData: nodeData
		});

		const now = new Date();
		const isOverdue = task.dueDate ? new Date(task.dueDate) < now : false;

		const nodeTitle = this.extractNodeTitle(nodeData?.nodeData, nodeData?.templateType);
		const nodeType = nodeData?.templateType || 'unknown';
		
		console.log('FirebaseTaskService.addTask: Extracted node info:', {
			nodeTitle,
			nodeType,
			inputNodeData: nodeData?.nodeData,
			inputTemplateType: nodeData?.templateType
		});

		const storedTask: Omit<StoredTask, 'id'> = {
			title: task.title,
			assignee: task.assignee,
			dueDate: task.dueDate || '',
			notes: task.notes || '',
			createdAt: now.toISOString(),
			status: task.status || 'active',
			projectId: project.id,
			projectSlug: projectSlug,
			projectTitle: project.title,
			nodeId: nodeId,
			nodeTitle: nodeTitle,
			nodeType: nodeType,
			createdBy: get(authStore).user?.uid || 'anonymous',
			isOverdue
		};

		const docRef = await addDoc(collection(db, 'tasks'), storedTask);
		// Update the document with its own ID
		await updateDoc(docRef, { id: docRef.id });
	}

	async updateTask(nodeId: string, taskId: string, updates: Partial<Task>, projectSlug?: string): Promise<void> {
		const q = query(collection(db, 'tasks'), where('id', '==', taskId));
		const snapshot = await getDocs(q);
		
		if (snapshot.empty) {
			throw new Error(`Task not found: ${taskId}`);
		}
		
		const taskDoc = snapshot.docs[0];
		const now = new Date();
		const currentData = taskDoc.data() as StoredTask;
		
		// Calculate if overdue status changed
		const newDueDate = updates.dueDate || currentData.dueDate;
		const isOverdue = newDueDate ? new Date(newDueDate) < now : false;
		
		await updateDoc(taskDoc.ref, {
			...updates,
			isOverdue,
			updatedAt: now.toISOString()
		});
	}

	async deleteTask(nodeId: string, taskId: string, projectSlug?: string): Promise<void> {
		if (!taskId) {
			throw new Error('Task ID is required for deletion');
		}
		if (!nodeId) {
			throw new Error('Node ID is required for deletion');
		}

		const q = query(
			collection(db, 'tasks'),
			where('id', '==', taskId),
			where('nodeId', '==', nodeId)
		);

		const snapshot = await getDocs(q);
		
		for (const docSnap of snapshot.docs) {
			await deleteDoc(docSnap.ref);
		}
	}

	async resolveTask(nodeId: string, taskId: string, projectSlug?: string): Promise<void> {
		await this.updateTask(nodeId, taskId, { status: 'resolved' }, projectSlug);
	}

	async getActiveTasks(): Promise<TaskWithContext[]> {
		return this.getAllTasks(); // Already filters for active tasks
	}

	async getResolvedTasks(): Promise<TaskWithContext[]> {
		const q = query(
			collection(db, 'tasks'),
			where('status', '==', 'resolved'),
			orderBy('createdAt', 'desc')
		);
		const snapshot = await getDocs(q);
		return snapshot.docs.map(doc => this.toTaskWithContext(doc.data() as StoredTask));
	}

	// Cache for task counts to avoid repeated expensive queries
	private taskCountsCache = new Map<string, { counts: TaskCounts, timestamp: number }>();
	private readonly TASK_CACHE_DURATION = 30000; // 30 seconds

	async getTaskCounts(projectSlug?: string): Promise<TaskCounts> {
		const cacheKey = projectSlug || 'global';
		
		// Check cache first
		const cached = this.taskCountsCache.get(cacheKey);
		if (cached && (Date.now() - cached.timestamp) < this.TASK_CACHE_DURATION) {
			console.log(`FirebaseTaskService: Using cached task counts for ${cacheKey}`);
			return cached.counts;
		}

		const tasks = projectSlug ? await this.getProjectTasks(projectSlug) : await this.getAllTasks();
		const counts = {
			total: tasks.length
		};
		
		// Cache the result
		this.taskCountsCache.set(cacheKey, { counts, timestamp: Date.now() });
		console.log(`FirebaseTaskService: Cached task counts for ${cacheKey}:`, counts);
		
		return counts;
	}

	async getOverdueTasks(projectSlug?: string): Promise<TaskWithContext[]> {
		let q;
		if (projectSlug) {
			q = query(
				collection(db, 'tasks'),
				where('projectSlug', '==', projectSlug),
				where('isOverdue', '==', true),
				orderBy('createdAt', 'desc')
			);
		} else {
			q = query(
				collection(db, 'tasks'),
				where('isOverdue', '==', true),
				orderBy('createdAt', 'desc')
			);
		}

		const snapshot = await getDocs(q);
		return snapshot.docs.map(doc => this.toTaskWithContext(doc.data() as StoredTask));
	}

	async updateOverdueStatus(): Promise<void> {
		// Get all tasks that might need overdue status updates
		const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
		const snapshot = await getDocs(q);
		const now = new Date();
		
		const batch = writeBatch(db);
		let batchCount = 0;
		
		snapshot.docs.forEach((taskDoc) => {
			const data = taskDoc.data() as StoredTask;
			const wouldBeOverdue = data.dueDate ? new Date(data.dueDate) < now : false;
			
			// Only update if overdue status has changed
			if (data.isOverdue !== wouldBeOverdue) {
				batch.update(taskDoc.ref, { 
					isOverdue: wouldBeOverdue,
					updatedAt: now.toISOString()
				});
				batchCount++;
				
				// Firestore batch limit is 500 operations
				if (batchCount >= 500) {
					batch.commit();
					// Would need to create a new batch here for more updates
					return;
				}
			}
		});
		
		if (batchCount > 0) {
			await batch.commit();
		}
	}

	subscribeToNodeTasks(
		nodeId: string, 
		callback: (tasks: Task[]) => void,
		projectSlug?: string
	): Unsubscribe {
		let q;
		if (projectSlug) {
			q = query(
				collection(db, 'tasks'),
				where('projectSlug', '==', projectSlug),
				where('nodeId', '==', nodeId),
				where('status', 'in', ['active', null]),
				orderBy('createdAt', 'desc')
			);
		} else {
			q = query(
				collection(db, 'tasks'),
				where('nodeId', '==', nodeId),
				where('status', 'in', ['active', null]),
				orderBy('createdAt', 'desc')
			);
		}

		return onSnapshot(q, (snapshot) => {
			const tasks = snapshot.docs.map(doc => {
				const data = doc.data() as StoredTask;
				return {
					id: data.id,
					title: data.title,
					assignee: data.assignee,
					dueDate: data.dueDate,
					notes: data.notes,
					createdAt: data.createdAt,
					status: data.status || 'active'
				};
			});
			callback(tasks);
		});
	}

	subscribeToPersonTasks(
		personId: string, 
		callback: (tasks: TaskWithContext[]) => void,
		projectSlug?: string
	): Unsubscribe {
		let q;
		if (projectSlug) {
			q = query(
				collection(db, 'tasks'),
				where('projectSlug', '==', projectSlug),
				where('assignee', '==', personId),
				orderBy('createdAt', 'desc')
			);
		} else {
			q = query(
				collection(db, 'tasks'),
				where('assignee', '==', personId),
				orderBy('createdAt', 'desc')
			);
		}

		return onSnapshot(q, (snapshot) => {
			const tasks = snapshot.docs.map(doc => 
				this.toTaskWithContext(doc.data() as StoredTask)
			);
			callback(tasks);
		});
	}

	subscribeToProjectTasks(
		projectSlug: string,
		callback: (tasks: TaskWithContext[]) => void
	): Unsubscribe {
		const q = query(
			collection(db, 'tasks'),
			where('projectSlug', '==', projectSlug),
			orderBy('createdAt', 'desc')
		);

		return onSnapshot(q, (snapshot) => {
			const tasks = snapshot.docs.map(doc => 
				this.toTaskWithContext(doc.data() as StoredTask)
			);
			callback(tasks);
		});
	}

	// Refresh node titles for all tasks (call when nodes are updated)
	async refreshNodeTitles(): Promise<void> {
		console.log('FirebaseTaskService.refreshNodeTitles: Starting refresh...');
		
		// Get all tasks
		const tasksQuery = query(collection(db, 'tasks'));
		const tasksSnapshot = await getDocs(tasksQuery);
		
		const batch = writeBatch(db);
		let batchCount = 0;
		let hasChanges = false;

		for (const taskDoc of tasksSnapshot.docs) {
			const task = taskDoc.data() as StoredTask;
			
			try {
				// Get current node data - use document ID directly
				const nodeDocRef = doc(db, 'projects', task.projectId, 'nodes', task.nodeId);
				const nodeSnapshot = await getDoc(nodeDocRef);
				
				if (nodeSnapshot.exists()) {
					const nodeData = nodeSnapshot.data();
					const newNodeTitle = this.extractNodeTitle(nodeData?.nodeData, nodeData?.templateType);
					const newNodeType = nodeData?.templateType || 'unknown';
					
					if (task.nodeTitle !== newNodeTitle || task.nodeType !== newNodeType) {
						console.log(`FirebaseTaskService.refreshNodeTitles: Updating task ${task.id}:`, {
							oldTitle: task.nodeTitle,
							newTitle: newNodeTitle,
							oldType: task.nodeType,
							newType: newNodeType
						});
						
						batch.update(taskDoc.ref, {
							nodeTitle: newNodeTitle,
							nodeType: newNodeType,
							updatedAt: new Date().toISOString()
						});
						
						batchCount++;
						hasChanges = true;
						
						// Firestore batch limit is 500 operations
						if (batchCount >= 500) {
							await batch.commit();
							// Would need to create a new batch here for more updates
							break;
						}
					}
				}
			} catch (error) {
				console.warn(`FirebaseTaskService.refreshNodeTitles: Error updating task ${task.id}:`, error);
			}
		}

		if (hasChanges && batchCount > 0) {
			await batch.commit();
			console.log('FirebaseTaskService.refreshNodeTitles: Updated and saved tasks');
		} else {
			console.log('FirebaseTaskService.refreshNodeTitles: No changes needed');
		}
	}

	// Optimized method to refresh task titles for a specific node only
	async refreshNodeTitlesForNode(nodeId: string, projectId: string, nodeTitle?: string, nodeType?: string): Promise<void> {
		console.log(`FirebaseTaskService.refreshNodeTitlesForNode: Starting refresh for node ${nodeId}...`);
		
		// Get tasks only for this specific node
		const tasksQuery = query(
			collection(db, 'tasks'),
			where('nodeId', '==', nodeId),
			where('projectId', '==', projectId)
		);
		const tasksSnapshot = await getDocs(tasksQuery);
		
		if (tasksSnapshot.empty) {
			console.log(`FirebaseTaskService.refreshNodeTitlesForNode: No tasks found for node ${nodeId}`);
			return;
		}
		
		// If nodeTitle and nodeType are provided (from the update), use them
		// Otherwise fetch the node data
		let newNodeTitle = nodeTitle;
		let newNodeType = nodeType;
		
		if (!newNodeTitle || !newNodeType) {
			const nodeDocRef = doc(db, 'projects', projectId, 'nodes', nodeId);
			const nodeSnapshot = await getDoc(nodeDocRef);
			
			if (nodeSnapshot.exists()) {
				const nodeData = nodeSnapshot.data();
				newNodeTitle = this.extractNodeTitle(nodeData?.nodeData, nodeData?.templateType);
				newNodeType = nodeData?.templateType || 'unknown';
			} else {
				console.warn(`FirebaseTaskService.refreshNodeTitlesForNode: Node ${nodeId} not found`);
				return;
			}
		}
		
		const batch = writeBatch(db);
		let batchCount = 0;
		let hasChanges = false;
		
		for (const taskDoc of tasksSnapshot.docs) {
			const task = taskDoc.data() as StoredTask;
			
			if (task.nodeTitle !== newNodeTitle || task.nodeType !== newNodeType) {
				console.log(`FirebaseTaskService.refreshNodeTitlesForNode: Updating task ${task.id}:`, {
					oldTitle: task.nodeTitle,
					newTitle: newNodeTitle,
					oldType: task.nodeType,
					newType: newNodeType
				});
				
				batch.update(taskDoc.ref, {
					nodeTitle: newNodeTitle,
					nodeType: newNodeType,
					updatedAt: new Date().toISOString()
				});
				
				batchCount++;
				hasChanges = true;
			}
		}
		
		if (hasChanges && batchCount > 0) {
			await batch.commit();
			console.log(`FirebaseTaskService.refreshNodeTitlesForNode: Updated ${batchCount} tasks for node ${nodeId}`);
		} else {
			console.log(`FirebaseTaskService.refreshNodeTitlesForNode: No changes needed for node ${nodeId}`);
		}
	}

	private toTaskWithContext(storedTask: StoredTask): TaskWithContext {
		return {
			id: storedTask.id,
			title: storedTask.title,
			assignee: storedTask.assignee,
			dueDate: storedTask.dueDate,
			notes: storedTask.notes,
			createdAt: storedTask.createdAt,
			status: storedTask.status || 'active',
			projectSlug: storedTask.projectSlug,
			projectTitle: storedTask.projectTitle,
			nodeId: storedTask.nodeId,
			nodeTitle: storedTask.nodeTitle,
			nodeType: storedTask.nodeType
		};
	}
}