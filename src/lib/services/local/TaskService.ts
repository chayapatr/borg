import type { Task, TaskWithContext, TaskCounts, PersonTaskCount, TaskSourceType } from '../../types/task';
import type { TaskSourceOptions } from '../interfaces/ITaskService';
import { ProjectsService } from './ProjectsService';
import { PeopleService } from './PeopleService';

interface StoredTask extends Task {
	// Source type: 'project' or 'wiki'
	sourceType?: TaskSourceType;
	// Context fields for efficient querying
	projectId: string;
	projectSlug: string;
	projectTitle: string;
	nodeId: string;
	nodeTitle: string;
	nodeType: string;
	// Wiki source fields
	wikiId?: string;
	wikiTitle?: string;
	createdBy?: string;
	updatedAt?: string;

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
							status: task.status || 'active',
							projectId: project.id,
							projectSlug: project.slug,
							projectTitle: project.title,
							nodeId: node.id,
							nodeTitle: this.extractNodeTitle(node.data?.nodeData, node.data?.templateType),
							nodeType: node.data?.templateType || 'node',
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
			console.log('TaskService.extractNodeTitle: nodeData is null/undefined');
			return 'Untitled';
		}
		
		const titleField = this.getTitleFieldName(templateType);
		const titleValue = nodeData[titleField];
		
		console.log('TaskService.extractNodeTitle:', {
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
					console.log(`TaskService.extractNodeTitle: Using fallback field '${field}': ${nodeData[field]}`);
					return nodeData[field];
				}
			}
			console.log('TaskService.extractNodeTitle: No valid title found, returning Untitled');
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
			updatedAt: storedTask.updatedAt,
			status: storedTask.status || 'active',
			sourceType: storedTask.sourceType || 'project',
			projectSlug: storedTask.projectSlug,
			projectTitle: storedTask.projectTitle,
			nodeId: storedTask.nodeId,
			nodeTitle: storedTask.nodeTitle,
			nodeType: storedTask.nodeType,
			wikiId: storedTask.wikiId,
			wikiTitle: storedTask.wikiTitle
		};
	}

	// Convert Task to StoredTask
	private toStoredTask(task: Task, projectSlug: string, nodeId: string): StoredTask {
		const project = this.projectsService.getProject(projectSlug);
		if (!project) throw new Error(`Project not found: ${projectSlug}`);

		// Get node info - try multiple storage patterns
		let node: any = null;
		
		// Try current storage format
		const storageKey = `things-canvas-data-${projectSlug}`;
		const stored = localStorage.getItem(storageKey);
		if (stored) {
			const data = JSON.parse(stored);
			node = data.nodes?.find((n: any) => n.id === nodeId);
		}

		// Fallback: try default storage if project-specific doesn't exist
		if (!node) {
			const defaultStored = localStorage.getItem('things-canvas-data');
			if (defaultStored) {
				const defaultData = JSON.parse(defaultStored);
				node = defaultData.nodes?.find((n: any) => n.id === nodeId);
			}
		}


		const nodeTitle = this.extractNodeTitle(node?.data?.nodeData, node?.data?.templateType);
		const nodeType = node?.data?.templateType || node?.type || 'node';
		
		console.log('TaskService.toStoredTask:', {
			nodeId,
			nodeTitle,
			nodeType,
			nodeExists: !!node,
			nodeDataExists: !!node?.data?.nodeData,
			templateType: node?.data?.templateType
		});

		return {
			...task,
			projectId: project.id,
			projectSlug: project.slug,
			projectTitle: project.title,
			nodeId,
			nodeTitle,
			nodeType,
			isOverdue: task.dueDate ? new Date(task.dueDate) < new Date() : false
		};
	}

	// Get all tasks across all projects (active only)
	getAllTasks(): TaskWithContext[] {
		const storedTasks = this.getAllStoredTasks();
		const activeTasks = storedTasks.filter(task => (task.status || 'active') === 'active');
		return activeTasks.map(task => this.toTaskWithContext(task));
	}

	// Get tasks for specific project (active only)
	getProjectTasks(projectSlug: string): TaskWithContext[] {
		const storedTasks = this.getAllStoredTasks();
		return storedTasks
			.filter(task => task.projectSlug === projectSlug && (task.status || 'active') === 'active')
			.map(task => this.toTaskWithContext(task));
	}

	// Get tasks for specific person (active only)
	getPersonTasks(personId: string): TaskWithContext[] {
		const storedTasks = this.getAllStoredTasks();
		return storedTasks
			.filter(task => task.assignee === personId && (task.status || 'active') === 'active')
			.map(task => this.toTaskWithContext(task));
	}

	// Get tasks for specific node (active only)
	getNodeTasks(nodeId: string, projectSlug?: string): Task[] {
		const storedTasks = this.getAllStoredTasks();
		console.log(`TaskService.getNodeTasks: Looking for tasks in node ${nodeId}, total stored tasks:`, storedTasks.length);
		
		// Filter for this node first
		const nodeTasksAll = storedTasks.filter(task => task.nodeId === nodeId);
		console.log(`TaskService.getNodeTasks: Found ${nodeTasksAll.length} tasks for node ${nodeId}:`, nodeTasksAll.map(t => ({id: t.id, title: t.title, status: t.status})));
		
		// Then filter for active only
		let filteredTasks = nodeTasksAll.filter(task => {
			const status = task.status || 'active';
			const isActive = status === 'active';
			console.log(`TaskService.getNodeTasks: Task ${task.id} has status '${task.status}' -> '${status}' -> isActive: ${isActive}`);
			return isActive;
		});
		console.log(`TaskService.getNodeTasks: After filtering for active status: ${filteredTasks.length} tasks`);
		
		if (projectSlug) {
			filteredTasks = filteredTasks.filter(task => task.projectSlug === projectSlug);
			console.log(`TaskService.getNodeTasks: After filtering for project ${projectSlug}: ${filteredTasks.length} tasks`);
		}

		return filteredTasks.map(task => ({
			id: task.id,
			title: task.title,
			assignee: task.assignee,
			dueDate: task.dueDate,
			notes: task.notes,
			createdAt: task.createdAt,
			status: task.status || 'active'
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
	addTask(nodeId: string, task: Omit<Task, 'id' | 'createdAt'>, projectSlugOrOptions?: string | TaskSourceOptions): void {
		// Parse options - support both old string format and new options format
		let options: TaskSourceOptions = {};
		if (typeof projectSlugOrOptions === 'string') {
			options = { projectSlug: projectSlugOrOptions };
		} else if (projectSlugOrOptions) {
			options = projectSlugOrOptions;
		}

		const newTask: Task = {
			...task,
			id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			createdAt: new Date().toISOString(),
			status: task.status || 'active'
		};

		// Handle wiki-based tasks
		if (options.wikiId) {
			const storedTask: StoredTask = {
				...newTask,
				sourceType: 'wiki',
				projectId: '',
				projectSlug: '',
				projectTitle: '',
				nodeId: nodeId,
				nodeTitle: options.wikiTitle || 'Untitled Wiki',
				nodeType: 'wiki',
				wikiId: options.wikiId,
				wikiTitle: options.wikiTitle || 'Untitled Wiki',
				isOverdue: newTask.dueDate ? new Date(newTask.dueDate) < new Date() : false
			};
			const allTasks = this.getAllStoredTasks();
			allTasks.push(storedTask);
			this.saveStoredTasks(allTasks);
			return;
		}

		// Handle project-based tasks (original logic)
		let projectSlug = options.projectSlug;
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

		if (taskIndex === -1) {
			console.warn('Task not found for update:', taskId, 'in node:', nodeId);
			return;
		}

		// Update the task
		const oldTask = allTasks[taskIndex];
		allTasks[taskIndex] = {
			...allTasks[taskIndex],
			...updates,
			updatedAt: new Date().toISOString(),
			// Recompute isOverdue if dueDate changed
			isOverdue: updates.dueDate ? new Date(updates.dueDate) < new Date() : allTasks[taskIndex].isOverdue
		};

		console.log('TaskService.updateTask: Task updated', {
			taskId,
			oldStatus: oldTask.status,
			newStatus: allTasks[taskIndex].status,
			updates
		});

		this.saveStoredTasks(allTasks);
		console.log('TaskService.updateTask: Tasks saved to storage');
	}

	// Delete task completely 
	deleteTask(nodeId: string, taskId: string, projectSlug?: string): void {
		const allTasks = this.getAllStoredTasks();
		const filteredTasks = allTasks.filter(task => 
			!(task.id === taskId && 
			  task.nodeId === nodeId &&
			  (!projectSlug || task.projectSlug === projectSlug))
		);

		this.saveStoredTasks(filteredTasks);
	}

	// Resolve task (mark as resolved instead of deleting)
	resolveTask(nodeId: string, taskId: string, projectSlug?: string): void {
		this.updateTask(nodeId, taskId, { status: 'resolved' }, projectSlug);
	}

	// Get only active tasks
	getActiveTasks(): TaskWithContext[] {
		return this.getAllTasks(); // Already filters for active tasks
	}

	// Get only resolved tasks
	getResolvedTasks(): TaskWithContext[] {
		const storedTasks = this.getAllStoredTasks();
		console.log('TaskService.getResolvedTasks: Total stored tasks:', storedTasks.length);
		console.log('TaskService.getResolvedTasks: Task statuses:', storedTasks.map(t => ({id: t.id, title: t.title, status: t.status})));
		const resolvedTasks = storedTasks.filter(task => (task.status || 'active') === 'resolved');
		console.log('TaskService.getResolvedTasks: Found resolved tasks:', resolvedTasks.length);
		return resolvedTasks.map(task => this.toTaskWithContext(task));
	}

	getPersonResolvedTasksLog(personId: string, daysBack: number = 30): TaskWithContext[] {
		const storedTasks = this.getAllStoredTasks();
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - daysBack);
		
		const resolvedTasks = storedTasks.filter(task => {
			// Filter by assignee and status
			if (task.assignee !== personId || (task.status || 'active') !== 'resolved') {
				return false;
			}
			
			// Filter by date (use updatedAt if available, otherwise createdAt)
			const taskDate = task.updatedAt ? new Date(task.updatedAt) : new Date(task.createdAt);
			return taskDate >= cutoffDate;
		});

		// Sort by date (updatedAt if available, otherwise createdAt) in descending order
		resolvedTasks.sort((a, b) => {
			const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(a.createdAt);
			const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(b.createdAt);
			return dateB.getTime() - dateA.getTime();
		});

		return resolvedTasks.map(task => this.toTaskWithContext(task));
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

	// Refresh node titles for all tasks (call when nodes are updated)
	refreshNodeTitles(): void {
		console.log('TaskService.refreshNodeTitles: Starting refresh...');
		const allTasks = this.getAllStoredTasks();
		let hasChanges = false;

		allTasks.forEach(task => {
			// Get current node data
			const storageKey = `things-canvas-data-${task.projectSlug}`;
			const stored = localStorage.getItem(storageKey);
			if (!stored) return;

			const data = JSON.parse(stored);
			const node = data.nodes?.find((n: any) => n.id === task.nodeId);
			
			if (node) {
				const newNodeTitle = this.extractNodeTitle(node.data?.nodeData, node.data?.templateType);
				const newNodeType = node.data?.templateType || node.type || 'node';
				
				if (task.nodeTitle !== newNodeTitle || task.nodeType !== newNodeType) {
					console.log(`TaskService.refreshNodeTitles: Updating task ${task.id}:`, {
						oldTitle: task.nodeTitle,
						newTitle: newNodeTitle,
						oldType: task.nodeType,
						newType: newNodeType
					});
					task.nodeTitle = newNodeTitle;
					task.nodeType = newNodeType;
					hasChanges = true;
				}
			}
		});

		if (hasChanges) {
			this.saveStoredTasks(allTasks);
			console.log('TaskService.refreshNodeTitles: Updated and saved tasks');
		} else {
			console.log('TaskService.refreshNodeTitles: No changes needed');
		}
	}
}