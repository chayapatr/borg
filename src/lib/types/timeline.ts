import type { TemplateField } from '../templates';

export interface TimelineTemplate {
	id: string;
	name: string;
	color: string;
	icon: string;
	fields: TemplateField[];
	predefinedOptions?: any[];
}

export interface TimelineEvent {
	id: string;
	templateType: string;
	title: string;
	timestamp: string;
	eventData: Record<string, any>;
	createdAt: string;
	updatedAt: string;
	createdBy?: string;
	projectId?: string | null;
}

export const timelineTemplates: Record<string, TimelineTemplate> = {
	conference: {
		id: 'conference',
		name: 'Conference',
		color: '#3b82f6',
		icon: 'calendar',
		fields: [
			{ id: 'title', label: 'Title', type: 'text', placeholder: 'Conference name' },
			{ id: 'timestamp', label: 'Date & Time', type: 'datetime', defaultValue: '-4' },
			{ id: 'venue', label: 'Venue', type: 'text', placeholder: 'Location or virtual' },
			{ id: 'website', label: 'Website', type: 'link', placeholder: 'https://conference.org' },
			{ id: 'organization', label: 'Organization', type: 'text', placeholder: 'ACM, IEEE, etc.' }
		]
	},
	grant: {
		id: 'grant',
		name: 'Grant Deadline',
		color: '#10b981',
		icon: 'dollar-sign',
		fields: [
			{ id: 'title', label: 'Grant Name', type: 'text', placeholder: 'NSF CAREER Award' },
			{ id: 'timestamp', label: 'Deadline', type: 'datetime', defaultValue: '-5' },
			{ id: 'amount', label: 'Amount', type: 'text', placeholder: '$500,000' },
			{ id: 'agency', label: 'Agency', type: 'text', placeholder: 'NSF, NIH, etc.' },
			{ id: 'website', label: 'Website', type: 'link' },
			{ id: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Requirements, collaborators, etc.' }
		]
	},
	deadline: {
		id: 'deadline',
		name: 'Important Deadline',
		color: '#ef4444',
		icon: 'clock',
		fields: [
			{ id: 'title', label: 'Title', type: 'text', placeholder: 'Paper submission' },
			{ id: 'timestamp', label: 'Deadline', type: 'datetime', defaultValue: '-5' },
			{ id: 'description', label: 'Description', type: 'textarea', placeholder: 'What needs to be done' },
			{ id: 'priority', label: 'Priority', type: 'status', options: ['Low', 'Medium', 'High', 'Critical'] }
		]
	},
	event: {
		id: 'event',
		name: 'Event',
		color: '#8b5cf6',
		icon: 'calendar-days',
		fields: [
			{ id: 'title', label: 'Event Name', type: 'text', placeholder: 'Workshop, meeting, etc.' },
			{ id: 'timestamp', label: 'Date & Time', type: 'datetime', defaultValue: '-4' },
			{ id: 'location', label: 'Location', type: 'text', placeholder: 'Room, building, or virtual' },
			{ id: 'description', label: 'Description', type: 'textarea' },
			{ id: 'attendees', label: 'Attendees', type: 'tags', placeholder: 'Add person' }
		]
	}
};

export function getTimelineTemplate(templateType: string): TimelineTemplate {
	return timelineTemplates[templateType] || timelineTemplates.event;
}
