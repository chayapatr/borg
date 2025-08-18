export interface NodeTemplate {
	id: string;
	name: string;
	color: string;
	fields: TemplateField[];
}

export interface CustomField extends TemplateField {
	id: string;
	isCustom: true;
}

export interface TemplateField {
	id: string;
	label: string;
	type:
		| 'text'
		| 'textarea'
		| 'tags'
		| 'status'
		| 'link'
		| 'date'
		| 'time'
		| 'datetime'
		| 'button'
		| 'people-selector'
		| 'timeline-selector'
		| 'color-picker'
		| 'select';
	placeholder?: string;
	options?: string[];
	required?: boolean;
	buttonText?: string;
	buttonUrl?: string;
	showInDisplay?: boolean; // Controls visibility in display mode, defaults to true
	defaultValue?: string; // Default value for the field
}

export const nodeTemplates: Record<string, NodeTemplate> = {
	project: {
		id: 'project',
		name: 'Project',
		color: '#52525b',
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
				type: 'people-selector',
				placeholder: 'Add collaborators...'
			},
			{
				id: 'status',
				label: 'Status',
				type: 'status',
				options: ['To Do', 'Doing', 'Done']
			},
			{
				id: 'website',
				label: 'Website',
				type: 'link',
				placeholder: 'https://...'
			}
		]
	},

	subproject: {
		id: 'subproject',
		name: 'Subproject',
		color: '#52525b',
		fields: [
			{
				id: 'title',
				label: 'Subproject Name',
				type: 'text',
				placeholder: 'Enter subproject name...',
				required: true
			},
			{
				id: 'collaborators',
				label: 'Collaborators',
				type: 'people-selector',
				placeholder: 'Add collaborators...'
			},
			{
				id: 'status',
				label: 'Status',
				type: 'status',
				options: ['To Do', 'Doing', 'Done']
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
		color: '#52525b',
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
				options: ['To Do', 'Doing', 'Done']
			},
			{
				id: 'publicationStatus',
				label: 'Publication Status',
				type: 'status',
				options: ['Draft', 'In Review', 'Accepted', 'Published']
			}
		]
	},

	code: {
		id: 'code',
		name: 'Code',
		color: '#52525b',
		fields: [
			{
				id: 'title',
				label: 'Repository Name',
				type: 'text',
				placeholder: 'Enter repo name...',
				required: true
			},
			{
				id: 'status',
				label: 'Status',
				type: 'status',
				options: ['To Do', 'Doing', 'Done']
			}
		]
	},

	time: {
		id: 'time',
		name: 'Time',
		color: '#52525b',
		fields: [
			{
				id: 'event',
				label: 'Timeline Event',
				type: 'timeline-selector',
				placeholder: 'Select or create timeline event...'
			},
			{
				id: 'status',
				label: 'Status',
				type: 'status',
				options: ['To Do', 'Doing', 'Done']
			},
			{
				id: 'notes',
				label: 'Notes',
				type: 'textarea',
				placeholder: 'Additional notes about this event...'
			}
		]
	},

	link: {
		id: 'link',
		name: 'Link',
		color: '#52525b',
		fields: [
			{
				id: 'title',
				label: 'Link Name',
				type: 'text',
				placeholder: 'Enter link name...',
				required: true
			},
			// {
			// 	id: 'url',
			// 	label: 'URL',
			// 	type: 'link',
			// 	placeholder: 'https://...'
			// },
			{
				id: 'status',
				label: 'Status',
				type: 'status',
				options: ['To Do', 'Doing', 'Done']
			}
		]
	},

	note: {
		id: 'note',
		name: 'Post-It',
		color: '#fef08a', // Default yellow post-it color
		fields: [
			{
				id: 'content',
				label: 'Note Content',
				type: 'textarea',
				placeholder: 'Write your note here...',
				required: true
			},
			{
				id: 'backgroundColor',
				label: 'Background Color',
				type: 'color-picker',
				placeholder: 'Choose background color'
			},
			{
				id: 'textSize',
				label: 'Text Size',
				type: 'select',
				options: ['Small', 'Medium', 'Large', 'Extra Large'],
				placeholder: 'Choose text size'
			}
		]
	},

	blank: {
		id: 'blank',
		name: 'Blank',
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
				id: 'status',
				label: 'Status',
				type: 'status',
				options: ['To Do', 'Doing', 'Done']
			}
		]
	},

	sticker: {
		id: 'sticker',
		name: 'Sticker',
		color: '#f59e0b',
		fields: [
			{
				id: 'title',
				label: 'Sticker Name',
				type: 'text',
				placeholder: 'Enter sticker name...',
				required: true
			}
		]
	}
};

// Suggested custom fields for each template type
export const suggestedCustomFields: Record<string, TemplateField[]> = {
	code: [
		{
			id: 'github',
			label: 'GitHub',
			type: 'link',
			placeholder: 'https://github.com/...'
		},
		{
			id: 'deepnote',
			label: 'Deepnote',
			type: 'link',
			placeholder: 'https://deepnote.com/...'
		}
	],
	paper: [
		{
			id: 'overleaf',
			label: 'Overleaf',
			type: 'link',
			placeholder: 'https://overleaf.com/...'
		},
		{
			id: 'arxiv',
			label: 'ArXiv',
			type: 'link',
			placeholder: 'https://arxiv.org/...'
		},
		{
			id: 'publisher',
			label: 'Publisher',
			type: 'link',
			placeholder: 'https://...'
		}
	],
	link: [
		{
			id: 'google_docs',
			label: 'Google Docs',
			type: 'link',
			placeholder: 'https://docs.google.com/document/...'
		},
		{
			id: 'google_sheets',
			label: 'Google Sheets',
			type: 'link',
			placeholder: 'https://docs.google.com/spreadsheets/...'
		},
		{
			id: 'google_slides',
			label: 'Google Slides',
			type: 'link',
			placeholder: 'https://docs.google.com/presentation/...'
		},
		{
			id: 'google_drive',
			label: 'Google Drive',
			type: 'link',
			placeholder: 'https://drive.google.com/...'
		},
		{
			id: 'website',
			label: 'Website',
			type: 'link',
			placeholder: 'https://...'
		},
		{
			id: 'dropbox',
			label: 'Dropbox',
			type: 'link',
			placeholder: 'https://dropbox.com/...'
		}
	]
};

export function getSuggestedFields(templateId: string): TemplateField[] {
	return suggestedCustomFields[templateId] || [];
}

export function getTemplate(templateId: string): NodeTemplate {
	return nodeTemplates[templateId] || nodeTemplates.blank;
}
