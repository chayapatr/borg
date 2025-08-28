export interface Project {
	id: string;
	slug: string;
	title: string;
	description?: string;
	status: 'active' | 'archived' | 'planning';
	createdAt: string;
	updatedAt: string;
	nodeCount: number;
	collaborators: string[];
	viewportPosition?: {
		x: number;
		y: number;
		zoom: number;
	};
}

// Import authStore for access control
import { authStore } from '../../stores/authStore';
import { get } from 'svelte/store';
import { ServiceFactory } from '../ServiceFactory';
import type { IUserService } from '../interfaces';

export class ProjectsService {
	private storageKey = 'things-projects';
	private statusCountsCache = new Map<
		string,
		{ counts: { todo: number; doing: number; done: number }; lastUpdated: number }
	>();
	private readonly CACHE_DURATION = 10000; // 10 seconds

	getAllProjects(): Project[] {
		try {
			const stored = localStorage.getItem(this.storageKey);
			const allProjects = stored ? JSON.parse(stored) : [];
			
			// Filter projects based on user type
			const authState = get(authStore);
			if (authState.userType === 'collaborator' && authState.user) {
				// Collaborators only see projects they're added to
				return allProjects.filter((project: Project) => 
					project.collaborators?.includes(authState.user!.uid)
				);
			}
			
			// Members see all projects
			return allProjects;
		} catch (error) {
			console.error('Failed to load projects:', error);
			return [];
		}
	}

	getDeletedProjects(): Project[] {
		try {
			const stored = localStorage.getItem('things-recycle-bin');
			return stored ? JSON.parse(stored) : [];
		} catch (error) {
			console.error('Failed to load deleted projects:', error);
			return [];
		}
	}

	getProject(slug: string): Project | null {
		const projects = this.getAllProjects();
		return projects.find((p) => p.slug === slug) || null;
	}

	createProject(data: { title: string; description?: string; status?: string }): Project {
		const projects = this.getAllProjects();
		const slug = this.generateSlug(data.title);

		const project: Project = {
			id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			slug,
			title: data.title,
			description: data.description,
			status: (data.status as Project['status']) || 'active',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			nodeCount: 0,
			collaborators: []
		};

		projects.push(project);
		this.saveProjects(projects);
		return project;
	}

	updateProject(slug: string, updates: Partial<Project>): Project | null {
		const projects = this.getAllProjects();

		const index = projects.findIndex((p) => p.slug === slug);

		if (index === -1) return null;

		projects[index] = {
			...projects[index],
			...updates,
			updatedAt: new Date().toISOString()
		};

		this.saveProjects(projects);
		return projects[index];
	}

	deleteProject(slug: string): boolean {
		const projects = this.getAllProjects();
		const projectToDelete = projects.find((p) => p.slug === slug);
		
		if (!projectToDelete) return false;

		// Remove from active projects
		const filtered = projects.filter((p) => p.slug !== slug);
		this.saveProjects(filtered);

		// Move to recycle bin
		const deletedProjects = this.getDeletedProjects();
		const deletedProject = {
			...projectToDelete,
			deletedAt: new Date().toISOString(),
			deletedBy: 'user'
		};
		deletedProjects.push(deletedProject);
		
		try {
			localStorage.setItem('things-recycle-bin', JSON.stringify(deletedProjects));
		} catch (error) {
			console.error('Failed to move project to recycle bin:', error);
		}

		// Move project canvas data to recycle bin
		try {
			const canvasData = localStorage.getItem(`things-canvas-data-${slug}`);
			if (canvasData) {
				localStorage.setItem(`things-recycle-canvas-data-${slug}`, canvasData);
				localStorage.removeItem(`things-canvas-data-${slug}`);
			}
		} catch (error) {
			console.error('Failed to move project canvas data:', error);
		}

		return true;
	}

	updateNodeCount(slug: string, count: number): void {
		this.updateProject(slug, { nodeCount: count });
	}

	// Invalidate status cache for a project
	invalidateStatusCache(slug: string): void {
		this.statusCountsCache.delete(slug);
	}

	// Invalidate all status caches
	invalidateAllStatusCaches(): void {
		this.statusCountsCache.clear();
	}

	getGlobalStatusCounts(): { todo: number; doing: number; done: number } {
		const projects = this.getAllProjects();
		const counts = { todo: 0, doing: 0, done: 0 };

		projects.forEach((project) => {
			const projectCounts = this.getProjectStatusCounts(project.slug);
			counts.todo += projectCounts.todo;
			counts.doing += projectCounts.doing;
			counts.done += projectCounts.done;
		});

		return counts;
	}

	getProjectStatusCounts(slug: string): { todo: number; doing: number; done: number } {
		try {
			// Check cache first
			const cached = this.statusCountsCache.get(slug);
			const now = Date.now();

			if (cached && now - cached.lastUpdated < this.CACHE_DURATION) {
				return cached.counts;
			}

			// Calculate fresh counts
			const storageKey = `things-canvas-data-${slug}`;
			const stored = localStorage.getItem(storageKey);
			if (!stored) {
				const emptyCounts = { todo: 0, doing: 0, done: 0 };
				this.statusCountsCache.set(slug, { counts: emptyCounts, lastUpdated: now });
				return emptyCounts;
			}

			const data = JSON.parse(stored);
			const nodes = data.nodes || [];
			const counts = { todo: 0, doing: 0, done: 0 };

			nodes.forEach((node: { data?: { nodeData?: { status?: string } } }) => {
				const status = node.data?.nodeData?.status;
				if (status === 'To Do') {
					counts.todo++;
				} else if (status === 'Doing') {
					counts.doing++;
				} else if (status === 'Done') {
					counts.done++;
				}
			});

			// Cache the result
			this.statusCountsCache.set(slug, { counts, lastUpdated: now });

			return counts;
		} catch (error) {
			console.error('Failed to get project status counts:', error);
			return { todo: 0, doing: 0, done: 0 };
		}
	}

	private generateSlug(title: string): string {
		const baseSlug = title
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-')
			.trim()
			.substring(0, 50);

		const projects = this.getAllProjects();
		let slug = baseSlug;
		let counter = 1;

		while (projects.some((p) => p.slug === slug)) {
			slug = `${baseSlug}-${counter}`;
			counter++;
		}

		return slug;
	}

	private saveProjects(projects: Project[]): void {
		try {
			localStorage.setItem(this.storageKey, JSON.stringify(projects));
		} catch (error) {
			console.error('Failed to save projects:', error);
		}
	}

	// Helper method to get all projects without filtering (for internal operations)
	private getAllProjectsUnfiltered(): Project[] {
		try {
			const stored = localStorage.getItem(this.storageKey);
			return stored ? JSON.parse(stored) : [];
		} catch (error) {
			console.error('Failed to load projects:', error);
			return [];
		}
	}

	// Collaborator management methods
	addCollaboratorToProject(projectSlug: string, userId: string): boolean {
		try {
			const projects = this.getAllProjectsUnfiltered();
			const projectIndex = projects.findIndex(p => p.slug === projectSlug);
			
			if (projectIndex === -1) return false;

			// Check if user is already a collaborator
			if (projects[projectIndex].collaborators?.includes(userId)) {
				return true; // Already a collaborator
			}

			const collaborators = projects[projectIndex].collaborators || [];
			collaborators.push(userId);
			projects[projectIndex].collaborators = collaborators;
			projects[projectIndex].updatedAt = new Date().toISOString();

			this.saveProjects(projects);
			return true;
		} catch (error) {
			console.error('Failed to add collaborator to project:', error);
			return false;
		}
	}

	removeCollaboratorFromProject(projectSlug: string, userId: string): boolean {
		try {
			const projects = this.getAllProjectsUnfiltered();
			const projectIndex = projects.findIndex(p => p.slug === projectSlug);
			
			if (projectIndex === -1) return false;

			const collaborators = projects[projectIndex].collaborators?.filter(id => id !== userId) || [];
			projects[projectIndex].collaborators = collaborators;
			projects[projectIndex].updatedAt = new Date().toISOString();

			this.saveProjects(projects);
			return true;
		} catch (error) {
			console.error('Failed to remove collaborator from project:', error);
			return false;
		}
	}

	getProjectCollaborators(projectSlug: string): Array<{
		id: string;
		email: string;
		name: string;
		userType: 'member' | 'collaborator';
	}> {
		try {
			const projects = this.getAllProjectsUnfiltered();
			const project = projects.find(p => p.slug === projectSlug);
			
			if (!project || !project.collaborators) return [];

			// Get user service to fetch user details
			const userService = ServiceFactory.createUserService();
			
			// Get user details for each collaborator
			const collaboratorDetails: Array<{
				id: string;
				email: string;
				name: string;
				userType: 'member' | 'collaborator';
			}> = [];

			project.collaborators.forEach(userId => {
				const user = userService.getUser(userId);
				if (user) {
					collaboratorDetails.push({
						id: userId,
						email: user.email,
						name: user.name,
						userType: user.userType
					});
				}
			});

			return collaboratorDetails;
		} catch (error) {
			console.error('Failed to get project collaborators:', error);
			return [];
		}
	}
}
