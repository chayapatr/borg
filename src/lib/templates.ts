export interface NodeTemplate {
	id: string;
	name: string;
	color: string;
	fields: TemplateField[];
}

export interface TemplateField {
	id: string;
	label: string;
	type: 'text' | 'textarea' | 'tags' | 'status' | 'link' | 'date' | 'button';
	placeholder?: string;
	options?: string[];
	required?: boolean;
	buttonText?: string;
	buttonUrl?: string;
}

export const nodeTemplates: Record<string, NodeTemplate> = {
	project: {
		id: 'project',
		name: 'Project',
		color: '#3b82f6',
		fields: [
			{
				id: 'title',
				label: 'Project Name',
				type: 'text',
				placeholder: 'Enter project name...',
				required: true
			},
			{
				id: 'collaborators',
				label: 'Collaborators',
				type: 'tags',
				placeholder: 'Add collaborators...'
			},
			{
				id: 'status',
				label: 'Status',
				type: 'status',
				options: ['Planning', 'Active', 'On Hold', 'Completed']
			},
			{
				id: 'website',
				label: 'Website',
				type: 'link',
				placeholder: 'https://...'
			}
		]
	},

	paper: {
		id: 'paper',
		name: 'Paper',
		color: '#10b981',
		fields: [
			{
				id: 'title',
				label: 'Paper Title',
				type: 'text',
				placeholder: 'Enter paper title...',
				required: true
			},
			{
				id: 'status',
				label: 'Status',
				type: 'status',
				options: ['Draft', 'In Review', 'Under Revision', 'Accepted', 'Published']
			},
			{
				id: 'overleaf',
				label: '',
				type: 'button',
				buttonText: 'Open Overleaf'
			}
		]
	},

	code: {
		id: 'code',
		name: 'Code Repository',
		color: '#f59e0b',
		fields: [
			{
				id: 'title',
				label: 'Repository Name',
				type: 'text',
				placeholder: 'Enter repo name...',
				required: true
			},
			{
				id: 'github',
				label: '',
				type: 'button',
				buttonText: 'Open Github Repo'
			}
		]
	},

	conference: {
		id: 'conference',
		name: 'Conference',
		color: '#8b5cf6',
		fields: [
			{
				id: 'title',
				label: 'Conference Name',
				type: 'text',
				placeholder: 'Enter conference name...',
				required: true
			},
			{
				id: 'venue',
				label: 'Location',
				type: 'text',
				placeholder: 'City, Country...'
			},
			{
				id: 'deadline',
				label: 'Submission Deadline',
				type: 'date'
			},
			{
				id: 'acceptance_deadline',
				label: 'Acceptance Notification',
				type: 'date'
			},
			{
				id: 'organization',
				label: 'Organization',
				type: 'tags',
				placeholder: 'ACM, IEEE, etc...'
			},
			{
				id: 'website',
				label: 'Website',
				type: 'link',
				placeholder: 'https://...'
			}
		]
	},

	note: {
		id: 'note',
		name: 'Note',
		color: '#ef4444',
		fields: [
			{
				id: 'title',
				label: 'Note Title',
				type: 'text',
				placeholder: 'Enter note title...',
				required: true
			},
			{
				id: 'content',
				label: 'Content',
				type: 'textarea',
				placeholder: 'Write your notes here...'
			},
			{
				id: 'tags',
				label: 'Tags',
				type: 'tags',
				placeholder: 'Add tags...'
			}
		]
	},

	storage: {
		id: 'storage',
		name: 'Storage',
		color: '#06b6d4',
		fields: [
			{
				id: 'drive',
				label: '',
				type: 'button',
				buttonText: 'Open Google Drive'
			}
		]
	},

	blank: {
		id: 'blank',
		name: 'Blank Node',
		color: '#52525b',
		fields: [
			{
				id: 'title',
				label: 'Title',
				type: 'text',
				placeholder: 'Enter title...',
				required: true
			},
			{
				id: 'description',
				label: 'Description',
				type: 'textarea',
				placeholder: 'Enter description...'
			}
		]
	}
};

export function getTemplate(templateId: string): NodeTemplate {
	return nodeTemplates[templateId] || nodeTemplates.blank;
}
