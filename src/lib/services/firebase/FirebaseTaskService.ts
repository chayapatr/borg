import { 
	collection, 
	addDoc, 
	deleteDoc, 
	getDocs, 
	query, 
	where, 
	orderBy, 
	onSnapshot,
	type Unsubscribe 
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Task, TaskWithContext, TaskCounts, PersonTaskCount } from '../../types/task';
import type { ITaskService } from '../interfaces';

export interface StoredTask extends Task {
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
	async getAllTasks(): Promise<TaskWithContext[]> {
		const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
		const snapshot = await getDocs(q);
		return snapshot.docs.map(doc => this.toTaskWithContext(doc.data() as StoredTask));
	}

	async getProjectTasks(projectSlug: string): Promise<TaskWithContext[]> {
		const q = query(
			collection(db, 'tasks'),
			where('projectSlug', '==', projectSlug),
			orderBy('createdAt', 'desc')
		);
		const snapshot = await getDocs(q);
		return snapshot.docs.map(doc => this.toTaskWithContext(doc.data() as StoredTask));
	}

	async getPersonTasks(personId: string): Promise<TaskWithContext[]> {
		const q = query(
			collection(db, 'tasks'),
			where('assignee', '==', personId),
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
				orderBy('createdAt', 'desc')
			);
		} else {
			q = query(
				collection(db, 'tasks'),
				where('nodeId', '==', nodeId),
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
				createdAt: data.createdAt
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

		const project = { id: projectSnapshot.docs[0].id, ...projectSnapshot.docs[0].data() };
		
		// Get node info
		const nodeQuery = query(collection(db, 'projects', project.id, 'nodes'), where('id', '==', nodeId));
		const nodeSnapshot = await getDocs(nodeQuery);
		
		const nodeData = nodeSnapshot.empty ? null : nodeSnapshot.docs[0].data();

		const now = new Date();
		const isOverdue = task.dueDate ? new Date(task.dueDate) < now : false;

		const storedTask: Omit<StoredTask, 'id'> = {
			title: task.title,
			assignee: task.assignee,
			dueDate: task.dueDate,
			notes: task.notes,
			createdAt: now.toISOString(),
			projectId: project.id,
			projectSlug: projectSlug,
			projectTitle: project.title,
			nodeId: nodeId,
			nodeTitle: nodeData?.nodeData?.title || 'Untitled',
			nodeType: nodeData?.templateType || 'unknown',
			createdBy: 'current-user', // TODO: Get from auth context
			isOverdue
		};

		await addDoc(collection(db, 'tasks'), storedTask);
	}

	async updateTask(): Promise<void> {
		// TODO: Implement task updates if needed
		throw new Error('Task updates not implemented in Firebase service yet');
	}

	async deleteTask(nodeId: string, taskId: string, projectSlug?: string): Promise<void> {
		const q = query(
			collection(db, 'tasks'),
			where('id', '==', taskId),
			where('nodeId', '==', nodeId)
		);
		
		if (projectSlug) {
			// Add project slug filter if provided
		}

		const snapshot = await getDocs(q);
		
		for (const docSnap of snapshot.docs) {
			await deleteDoc(docSnap.ref);
		}
	}

	async getTaskCounts(projectSlug?: string): Promise<TaskCounts> {
		const tasks = projectSlug ? await this.getProjectTasks(projectSlug) : await this.getAllTasks();
		return {
			total: tasks.length
		};
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
		// In Firebase, we could use a cloud function to update overdue status
		// For now, we'll implement client-side checking
		const allTasks = await this.getAllTasks();
		const now = new Date();
		
		// This is inefficient for large datasets - ideally use cloud functions
		for (const task of allTasks) {
			// Check if overdue status needs updating
			const wouldBeOverdue = task.dueDate ? new Date(task.dueDate) < now : false;
			// Update if overdue status changed
			// TODO: Implement efficient batch update
			console.log(`Task ${task.id} overdue status: ${wouldBeOverdue}`);
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
				orderBy('createdAt', 'desc')
			);
		} else {
			q = query(
				collection(db, 'tasks'),
				where('nodeId', '==', nodeId),
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
					createdAt: data.createdAt
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

	private toTaskWithContext(storedTask: StoredTask): TaskWithContext {
		return {
			id: storedTask.id,
			title: storedTask.title,
			assignee: storedTask.assignee,
			dueDate: storedTask.dueDate,
			notes: storedTask.notes,
			createdAt: storedTask.createdAt,
			projectSlug: storedTask.projectSlug,
			projectTitle: storedTask.projectTitle,
			nodeId: storedTask.nodeId,
			nodeTitle: storedTask.nodeTitle,
			nodeType: storedTask.nodeType
		};
	}
}