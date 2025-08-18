import type { Project } from '../local/ProjectsService';

export interface IProjectsService {
	getAllProjects(): Promise<Project[]> | Project[];
	getProject(slug: string): Promise<Project | null> | Project | null;
	getProjectById?(id: string): Promise<Project | null> | Project | null;
	createProject(data: { 
		title: string; 
		description?: string; 
		status?: string;
		createdBy?: string;
	}): Promise<Project> | Project;
	updateProject(slugOrId: string, updates: Partial<Project>): Promise<Project | null> | Project | null;
	deleteProject(slugOrId: string): Promise<boolean> | boolean;
	updateNodeCount(slug: string, count: number): Promise<void> | void;
	invalidateStatusCache(slug: string): void;
	invalidateAllStatusCaches(): void;
	getGlobalStatusCounts(): Promise<{ todo: number; doing: number; done: number }> | { todo: number; doing: number; done: number };
	getProjectStatusCounts(slug: string): Promise<{ todo: number; doing: number; done: number }> | { todo: number; doing: number; done: number };
	
	// Real-time subscriptions (Firebase only)
	subscribeToProjects?(callback: (projects: Project[]) => void): () => void;
	subscribeToProject?(slug: string, callback: (project: Project | null) => void): () => void;
}