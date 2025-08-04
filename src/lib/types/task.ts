export interface Task {
	id: string;
	title: string;
	assignee: string; // person ID from PeopleService
	dueDate?: string; // ISO date string
	notes?: string;
	createdAt: string; // timestamp
	status?: 'active' | 'resolved'; // Default to 'active' for backward compatibility
}

export interface TaskWithContext extends Task {
	projectSlug?: string;
	projectTitle?: string;
	nodeId: string;
	nodeTitle: string;
	nodeType: string;
}

export interface TaskCounts {
	total: number;
}

export interface PersonTaskCount {
	personId: string;
	count: number;
}