import type { Task, TaskWithContext, TaskCounts, PersonTaskCount } from '../../types/task';

export interface ITaskService {
	getAllTasks(): Promise<TaskWithContext[]> | TaskWithContext[];
	getProjectTasks(projectSlug: string): Promise<TaskWithContext[]> | TaskWithContext[];
	getPersonTasks(personId: string): Promise<TaskWithContext[]> | TaskWithContext[];
	getNodeTasks(nodeId: string, projectSlug?: string): Promise<Task[]> | Task[];
	getNodePersonTaskCounts(nodeId: string, projectSlug?: string): Promise<PersonTaskCount[]> | PersonTaskCount[];
	addTask(nodeId: string, task: Omit<Task, 'id' | 'createdAt'>, projectSlug?: string): Promise<void> | void;
	updateTask(nodeId: string, taskId: string, updates: Partial<Task>, projectSlug?: string): Promise<void> | void;
	deleteTask(nodeId: string, taskId: string, projectSlug?: string): Promise<void> | void;
	resolveTask(nodeId: string, taskId: string, projectSlug?: string): Promise<void> | void;
	getActiveTasks(): Promise<TaskWithContext[]> | TaskWithContext[];
	getResolvedTasks(): Promise<TaskWithContext[]> | TaskWithContext[];
	getTaskCounts(projectSlug?: string): Promise<TaskCounts> | TaskCounts;
	getOverdueTasks(projectSlug?: string): Promise<TaskWithContext[]> | TaskWithContext[];
	updateOverdueStatus(): Promise<void> | void;
	refreshNodeTitles?(): Promise<void> | void;

	// Real-time subscriptions (Firebase only)
	subscribeToNodeTasks?(nodeId: string, callback: (tasks: Task[]) => void, projectSlug?: string): () => void;
	subscribeToPersonTasks?(personId: string, callback: (tasks: TaskWithContext[]) => void, projectSlug?: string): () => void;
	subscribeToProjectTasks?(projectSlug: string, callback: (tasks: TaskWithContext[]) => void): () => void;
}