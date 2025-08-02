import type { Task, TaskWithContext, TaskCounts, PersonTaskCount } from '../types/task';
import { ProjectsService } from './ProjectsService';
import { PeopleService } from './PeopleService';

export class TaskService {
	private projectsService: ProjectsService;
	private peopleService: PeopleService;

	constructor() {
		this.projectsService = new ProjectsService();
		this.peopleService = new PeopleService();
	}

	// Get all tasks across all projects
	getAllTasks(): TaskWithContext[] {
		const projects = this.projectsService.getAllProjects();
		const allTasks: TaskWithContext[] = [];

		projects.forEach((project) => {
			const projectTasks = this.getProjectTasks(project.slug);
			allTasks.push(...projectTasks);
		});

		return allTasks;
	}

	// Get tasks for specific project
	getProjectTasks(projectSlug: string): TaskWithContext[] {
		const project = this.projectsService.getProject(projectSlug);
		if (!project) return [];

		const storageKey = `things-canvas-data-${projectSlug}`;
		const stored = localStorage.getItem(storageKey);
		if (!stored) return [];

		const data = JSON.parse(stored);
		const tasks: TaskWithContext[] = [];

		if (data.nodes) {
			data.nodes.forEach((node: any) => {
				if (node.data?.tasks) {
					node.data.tasks.forEach((task: Task) => {
						tasks.push({
							...task,
							projectSlug,
							projectTitle: project.title,
							nodeId: node.id,
							nodeTitle: node.data?.nodeData?.title || 'Untitled',
							nodeType: node.data?.templateType || 'unknown'
						});
					});
				}
			});
		}

		return tasks;
	}

	// Get tasks for specific person
	getPersonTasks(personId: string): TaskWithContext[] {
		const allTasks = this.getAllTasks();
		return allTasks.filter((task) => task.assignee === personId && !task.resolvedAt);
	}

	// Get tasks for specific node
	getNodeTasks(nodeId: string, projectSlug?: string): Task[] {
		if (projectSlug) {
			const storageKey = `things-canvas-data-${projectSlug}`;
			const stored = localStorage.getItem(storageKey);
			if (!stored) return [];

			const data = JSON.parse(stored);
			const node = data.nodes?.find((n: any) => n.id === nodeId);
			return node?.data?.tasks || [];
		}

		// If no projectSlug, search across all projects
		const projects = this.projectsService.getAllProjects();
		for (const project of projects) {
			const tasks = this.getNodeTasks(nodeId, project.slug);
			if (tasks.length > 0) return tasks;
		}

		return [];
	}

	// Get person task counts for a node
	getNodePersonTaskCounts(nodeId: string, projectSlug?: string): PersonTaskCount[] {
		const tasks = this.getNodeTasks(nodeId, projectSlug);
		const activeTasks = tasks.filter((task) => !task.resolvedAt);

		const counts = new Map<string, number>();
		activeTasks.forEach((task) => {
			counts.set(task.assignee, (counts.get(task.assignee) || 0) + 1);
		});

		return Array.from(counts.entries()).map(([personId, count]) => ({
			personId,
			count
		}));
	}

	// Add task to node
	addTask(nodeId: string, task: Omit<Task, 'id' | 'createdAt'>, projectSlug?: string): void {
		const newTask: Task = {
			...task,
			id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			createdAt: new Date().toISOString()
		};

		if (projectSlug) {
			this.addTaskToProject(nodeId, newTask, projectSlug);
		} else {
			// Find the project containing this node
			const projects = this.projectsService.getAllProjects();
			for (const project of projects) {
				const storageKey = `things-canvas-data-${project.slug}`;
				const stored = localStorage.getItem(storageKey);
				if (!stored) continue;

				const data = JSON.parse(stored);
				const nodeExists = data.nodes?.some((n: any) => n.id === nodeId);
				if (nodeExists) {
					this.addTaskToProject(nodeId, newTask, project.slug);
					break;
				}
			}
		}
	}

	private addTaskToProject(nodeId: string, task: Task, projectSlug: string): void {
		const storageKey = `things-canvas-data-${projectSlug}`;
		const stored = localStorage.getItem(storageKey);
		if (!stored) return;

		const data = JSON.parse(stored);
		if (!data.nodes) return;

		const nodeIndex = data.nodes.findIndex((n: any) => n.id === nodeId);
		if (nodeIndex === -1) return;

		if (!data.nodes[nodeIndex].data.tasks) {
			data.nodes[nodeIndex].data.tasks = [];
		}

		data.nodes[nodeIndex].data.tasks.push(task);
		localStorage.setItem(storageKey, JSON.stringify(data));
	}

	// Update task
	updateTask(nodeId: string, taskId: string, updates: Partial<Task>, projectSlug?: string): void {
		if (projectSlug) {
			this.updateTaskInProject(nodeId, taskId, updates, projectSlug);
		} else {
			// Find the project containing this node
			const projects = this.projectsService.getAllProjects();
			for (const project of projects) {
				const success = this.updateTaskInProject(nodeId, taskId, updates, project.slug);
				if (success) break;
			}
		}
	}

	private updateTaskInProject(
		nodeId: string,
		taskId: string,
		updates: Partial<Task>,
		projectSlug: string
	): boolean {
		const storageKey = `things-canvas-data-${projectSlug}`;
		const stored = localStorage.getItem(storageKey);
		if (!stored) return false;

		const data = JSON.parse(stored);
		if (!data.nodes) return false;

		const node = data.nodes.find((n: any) => n.id === nodeId);
		if (!node?.data?.tasks) return false;

		const taskIndex = node.data.tasks.findIndex((t: Task) => t.id === taskId);
		if (taskIndex === -1) return false;

		node.data.tasks[taskIndex] = { ...node.data.tasks[taskIndex], ...updates };
		localStorage.setItem(storageKey, JSON.stringify(data));
		return true;
	}

	// Resolve task (sets resolvedAt timestamp)
	resolveTask(nodeId: string, taskId: string, projectSlug?: string): void {
		this.updateTask(nodeId, taskId, { resolvedAt: new Date().toISOString() }, projectSlug);
	}

	// Unresolve task (removes resolvedAt timestamp)
	unresolveTask(nodeId: string, taskId: string, projectSlug?: string): void {
		this.updateTask(nodeId, taskId, { resolvedAt: undefined }, projectSlug);
	}

	// Delete task completely
	deleteTask(nodeId: string, taskId: string, projectSlug?: string): void {
		if (projectSlug) {
			this.deleteTaskFromProject(nodeId, taskId, projectSlug);
		} else {
			// Find the project containing this node
			const projects = this.projectsService.getAllProjects();
			for (const project of projects) {
				const success = this.deleteTaskFromProject(nodeId, taskId, project.slug);
				if (success) break;
			}
		}
	}

	private deleteTaskFromProject(nodeId: string, taskId: string, projectSlug: string): boolean {
		const storageKey = `things-canvas-data-${projectSlug}`;
		const stored = localStorage.getItem(storageKey);
		if (!stored) return false;

		const data = JSON.parse(stored);
		if (!data.nodes) return false;

		const node = data.nodes.find((n: any) => n.id === nodeId);
		if (!node?.data?.tasks) return false;

		const taskIndex = node.data.tasks.findIndex((t: Task) => t.id === taskId);
		if (taskIndex === -1) return false;

		node.data.tasks.splice(taskIndex, 1);
		localStorage.setItem(storageKey, JSON.stringify(data));
		return true;
	}

	// Get task status counts
	getTaskCounts(projectSlug?: string): TaskCounts {
		const tasks = projectSlug ? this.getProjectTasks(projectSlug) : this.getAllTasks();

		return {
			active: tasks.filter((task) => !task.resolvedAt).length,
			resolved: tasks.filter((task) => task.resolvedAt).length
		};
	}
}
