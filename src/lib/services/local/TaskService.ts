import type { Task, TaskWithContext, TaskCounts, PersonTaskCount } from '../../types/task';
import { ProjectsService } from './ProjectsService';
import { PeopleService } from './PeopleService';

interface StoredTask extends Task {
	// Context fields for efficient querying
	projectId: string;
	projectSlug: string;
	projectTitle: string;
	nodeId: string;
	nodeTitle: string;
	nodeType: string;
	createdBy?: string;
	
	// Computed fields for efficient filtering
	isOverdue: boolean;
}

export class TaskService {
	private projectsService: ProjectsService;
	private peopleService: PeopleService;
	private readonly TASKS_STORAGE_KEY = 'borg-tasks';
	private migrationCompleted = false;

	constructor() {
		this.projectsService = new ProjectsService();
		this.peopleService = new PeopleService();
		this.ensureMigration();
	}

	// Migration: Move embedded tasks to separate storage
	private ensureMigration(): void {
		if (this.migrationCompleted || localStorage.getItem(`${this.TASKS_STORAGE_KEY}-migrated`)) {
			this.migrationCompleted = true;
			return;
		}

		console.log('Migrating tasks to separate storage...');
		const projects = this.projectsService.getAllProjects();
		const allTasks: StoredTask[] = [];

		projects.forEach((project) => {
			const storageKey = `things-canvas-data-${project.slug}`;
			const stored = localStorage.getItem(storageKey);
			if (!stored) return;

			const data = JSON.parse(stored);
			if (!data.nodes) return;

			data.nodes.forEach((node: any) => {
				if (node.data?.tasks && Array.isArray(node.data.tasks)) {
					node.data.tasks.forEach((task: any) => {
						// Skip resolved tasks during migration (they become deleted)
						if (task.resolvedAt) return;
						
						const storedTask: StoredTask = {
							id: task.id,
							title: task.title,
							assignee: task.assignee,
							dueDate: task.dueDate,
							notes: task.notes,
							createdAt: task.createdAt,
							projectId: project.id,
							projectSlug: project.slug,
							projectTitle: project.title,
							nodeId: node.id,
							nodeTitle: node.data?.nodeData?.title || 'Untitled',
							nodeType: node.data?.templateType || 'unknown',
							isOverdue: task.dueDate ? new Date(task.dueDate) < new Date() : false
						};
						allTasks.push(storedTask);
					});

					// Remove tasks from node data after migration
					delete node.data.tasks;
				}
			});

			// Save updated canvas data without embedded tasks
			localStorage.setItem(storageKey, JSON.stringify(data));
		});

		// Save migrated tasks to separate storage
		this.saveStoredTasks(allTasks);
		localStorage.setItem(`${this.TASKS_STORAGE_KEY}-migrated`, 'true');
		this.migrationCompleted = true;

		console.log(`Migrated ${allTasks.length} active tasks to separate storage`);
	}

	// Get all stored tasks from separate storage
	private getAllStoredTasks(): StoredTask[] {
		try {
			const stored = localStorage.getItem(this.TASKS_STORAGE_KEY);
			return stored ? JSON.parse(stored) : [];
		} catch (error) {
			console.error('Failed to load tasks:', error);
			return [];
		}
	}

	// Save tasks to separate storage
	private saveStoredTasks(tasks: StoredTask[]): void {
		try {
			localStorage.setItem(this.TASKS_STORAGE_KEY, JSON.stringify(tasks));
		} catch (error) {
			console.error('Failed to save tasks:', error);
		}
	}

	// Convert StoredTask to TaskWithContext
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

	// Convert Task to StoredTask
	private toStoredTask(task: Task, projectSlug: string, nodeId: string): StoredTask {
		const project = this.projectsService.getProject(projectSlug);
		if (!project) throw new Error(`Project not found: ${projectSlug}`);

		// Get node info
		const storageKey = `things-canvas-data-${projectSlug}`;
		const stored = localStorage.getItem(storageKey);
		const data = stored ? JSON.parse(stored) : { nodes: [] };
		const node = data.nodes?.find((n: any) => n.id === nodeId);

		return {
			...task,
			projectId: project.id,
			projectSlug: project.slug,
			projectTitle: project.title,
			nodeId,
			nodeTitle: node?.data?.nodeData?.title || 'Untitled',
			nodeType: node?.data?.templateType || 'unknown',
			isOverdue: task.dueDate ? new Date(task.dueDate) < new Date() : false
		};
	}

	// Get all tasks across all projects
	getAllTasks(): TaskWithContext[] {
		const storedTasks = this.getAllStoredTasks();
		return storedTasks.map(task => this.toTaskWithContext(task));
	}

	// Get tasks for specific project
	getProjectTasks(projectSlug: string): TaskWithContext[] {
		const storedTasks = this.getAllStoredTasks();
		return storedTasks
			.filter(task => task.projectSlug === projectSlug)
			.map(task => this.toTaskWithContext(task));
	}

	// Get tasks for specific person
	getPersonTasks(personId: string): TaskWithContext[] {
		const storedTasks = this.getAllStoredTasks();
		return storedTasks
			.filter(task => task.assignee === personId)
			.map(task => this.toTaskWithContext(task));
	}

	// Get tasks for specific node
	getNodeTasks(nodeId: string, projectSlug?: string): Task[] {
		const storedTasks = this.getAllStoredTasks();
		let filteredTasks = storedTasks.filter(task => task.nodeId === nodeId);
		
		if (projectSlug) {
			filteredTasks = filteredTasks.filter(task => task.projectSlug === projectSlug);
		}

		return filteredTasks.map(task => ({
			id: task.id,
			title: task.title,
			assignee: task.assignee,
			dueDate: task.dueDate,
			notes: task.notes,
			createdAt: task.createdAt
		}));
	}

	// Get person task counts for a node
	getNodePersonTaskCounts(nodeId: string, projectSlug?: string): PersonTaskCount[] {
		const tasks = this.getNodeTasks(nodeId, projectSlug);
		const counts = new Map<string, number>();
		
		tasks.forEach((task) => {
			counts.set(task.assignee, (counts.get(task.assignee) || 0) + 1);
		});

		return Array.from(counts.entries()).map(([personId, count]) => ({
			personId,
			count
		}));
	}

	// Add task to node
	addTask(nodeId: string, task: Omit<Task, 'id' | 'createdAt'>, projectSlug?: string): void {
		if (!projectSlug) {
			// Find the project containing this node
			const projects = this.projectsService.getAllProjects();
			for (const project of projects) {
				const storageKey = `things-canvas-data-${project.slug}`;
				const stored = localStorage.getItem(storageKey);
				if (!stored) continue;

				const data = JSON.parse(stored);
				const nodeExists = data.nodes?.some((n: any) => n.id === nodeId);
				if (nodeExists) {
					projectSlug = project.slug;
					break;
				}
			}
		}

		if (!projectSlug) {
			throw new Error(`Could not find project for node: ${nodeId}`);
		}

		const newTask: Task = {
			...task,
			id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			createdAt: new Date().toISOString()
		};

		const storedTask = this.toStoredTask(newTask, projectSlug, nodeId);
		const allTasks = this.getAllStoredTasks();
		allTasks.push(storedTask);
		this.saveStoredTasks(allTasks);
	}

	// Update task
	updateTask(nodeId: string, taskId: string, updates: Partial<Task>, projectSlug?: string): void {
		const allTasks = this.getAllStoredTasks();
		const taskIndex = allTasks.findIndex(task => 
			task.id === taskId && 
			task.nodeId === nodeId &&
			(!projectSlug || task.projectSlug === projectSlug)
		);

		if (taskIndex === -1) return;

		// Update the task
		allTasks[taskIndex] = {
			...allTasks[taskIndex],
			...updates,
			// Recompute isOverdue if dueDate changed
			isOverdue: updates.dueDate ? new Date(updates.dueDate) < new Date() : allTasks[taskIndex].isOverdue
		};

		this.saveStoredTasks(allTasks);
	}

	// Delete task completely (replaces resolve/unresolve)
	deleteTask(nodeId: string, taskId: string, projectSlug?: string): void {
		const allTasks = this.getAllStoredTasks();
		const filteredTasks = allTasks.filter(task => 
			!(task.id === taskId && 
			  task.nodeId === nodeId &&
			  (!projectSlug || task.projectSlug === projectSlug))
		);

		this.saveStoredTasks(filteredTasks);
	}

	// Get task counts
	getTaskCounts(projectSlug?: string): TaskCounts {
		const tasks = projectSlug ? this.getProjectTasks(projectSlug) : this.getAllTasks();
		return {
			total: tasks.length
		};
	}

	// Get overdue tasks
	getOverdueTasks(projectSlug?: string): TaskWithContext[] {
		const storedTasks = this.getAllStoredTasks();
		let filteredTasks = storedTasks.filter(task => task.isOverdue);
		
		if (projectSlug) {
			filteredTasks = filteredTasks.filter(task => task.projectSlug === projectSlug);
		}

		return filteredTasks.map(task => this.toTaskWithContext(task));
	}

	// Update overdue status for all tasks (call periodically)
	updateOverdueStatus(): void {
		const allTasks = this.getAllStoredTasks();
		let hasChanges = false;
		const now = new Date();

		allTasks.forEach(task => {
			const wasOverdue = task.isOverdue;
			const isOverdue = task.dueDate ? new Date(task.dueDate) < now : false;
			
			if (wasOverdue !== isOverdue) {
				task.isOverdue = isOverdue;
				hasChanges = true;
			}
		});

		if (hasChanges) {
			this.saveStoredTasks(allTasks);
		}
	}
}