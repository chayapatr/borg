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
}

export class ProjectsService {
	private storageKey = 'things-projects';

	getAllProjects(): Project[] {
		try {
			const stored = localStorage.getItem(this.storageKey);
			return stored ? JSON.parse(stored) : [];
		} catch (error) {
			console.error('Failed to load projects:', error);
			return [];
		}
	}

	getProject(slug: string): Project | null {
		const projects = this.getAllProjects();
		return projects.find(p => p.slug === slug) || null;
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
		const index = projects.findIndex(p => p.slug === slug);
		
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
		const filtered = projects.filter(p => p.slug !== slug);
		
		if (filtered.length === projects.length) return false;

		this.saveProjects(filtered);
		
		// Also delete project-specific data
		try {
			localStorage.removeItem(`things-canvas-data-${slug}`);
		} catch (error) {
			console.error('Failed to delete project data:', error);
		}

		return true;
	}

	updateNodeCount(slug: string, count: number): void {
		this.updateProject(slug, { nodeCount: count });
	}

	getGlobalStatusCounts(): { todo: number; doing: number; done: number } {
		const projects = this.getAllProjects();
		const counts = { todo: 0, doing: 0, done: 0 };
		
		projects.forEach(project => {
			const projectCounts = this.getProjectStatusCounts(project.slug);
			counts.todo += projectCounts.todo;
			counts.doing += projectCounts.doing;
			counts.done += projectCounts.done;
		});
		
		return counts;
	}

	getProjectStatusCounts(slug: string): { todo: number; doing: number; done: number } {
		try {
			const storageKey = `things-canvas-data-${slug}`;
			const stored = localStorage.getItem(storageKey);
			if (!stored) return { todo: 0, doing: 0, done: 0 };
			
			const data = JSON.parse(stored);
			const nodes = data.nodes || [];
			const counts = { todo: 0, doing: 0, done: 0 };
			
			nodes.forEach((node: { data?: { nodeData?: { status?: string } } }) => {
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

		while (projects.some(p => p.slug === slug)) {
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
}