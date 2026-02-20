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
