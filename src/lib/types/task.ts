export interface Task {
	id: string;
	title: string;
	assignee: string; // person ID from PeopleService
	dueDate?: string; // ISO date string
	notes?: string;
	createdAt: string; // timestamp
	status?: 'active' | 'resolved'; // Default to 'active' for backward compatibility
}

// Source type for tasks - can be from a project node or a wiki page
export type TaskSourceType = 'project' | 'wiki';

export interface TaskWithContext extends Task {
	// Source information
	sourceType?: TaskSourceType; // 'project' or 'wiki', defaults to 'project' for backward compat

	// Project source fields (used when sourceType is 'project')
	projectSlug?: string;
	projectTitle?: string;
	nodeId: string;
	nodeTitle: string;
	nodeType: string;

	// Wiki source fields (used when sourceType is 'wiki')
	wikiId?: string;
	wikiTitle?: string;

	updatedAt?: string;
}

export interface TaskCounts {
	total: number;
}

export interface PersonTaskCount {
	personId: string;
	count: number;
}