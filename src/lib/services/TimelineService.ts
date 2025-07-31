import type { TemplateField } from '../templates';

export interface TimelineTemplate {
	id: string;
	name: string;
	color: string;
	icon: string;
	fields: TemplateField[];
	predefinedOptions?: any[]; // For conferences, grants, etc.
}

export interface TimelineEvent {
	id: string;
	templateType: string;
	title: string;
	date: string;
	eventData: Record<string, any>; // Dynamic data based on template
	createdAt: string;
	updatedAt: string;
}

// Timeline Templates
export const timelineTemplates: Record<string, TimelineTemplate> = {
	conference: {
		id: 'conference',
		name: 'Conference',
		color: '#3b82f6',
		icon: 'calendar',
		fields: [
			{ id: 'title', label: 'Title', type: 'text', placeholder: 'Conference name' },
			{ id: 'date', label: 'Date', type: 'date' },
			{ id: 'venue', label: 'Venue', type: 'text', placeholder: 'Location or virtual' },
			{ id: 'submissionDeadline', label: 'Submission Deadline', type: 'date' },
			{ id: 'website', label: 'Website', type: 'link', placeholder: 'https://conference.org' },
			{ id: 'organization', label: 'Organization', type: 'text', placeholder: 'ACM, IEEE, etc.' }
		],
		predefinedOptions: [
			{
				id: 'chi2024',
				title: 'CHI 2024',
				venue: 'Honolulu, Hawaii',
				organization: 'ACM',
				website: 'https://chi2024.acm.org'
			},
			{
				id: 'neurips2024',
				title: 'NeurIPS 2024',
				venue: 'Vancouver, Canada',
				organization: 'NeurIPS Foundation',
				website: 'https://neurips.cc'
			},
			{
				id: 'moco2024',
				title: 'MOCO 2024',
				venue: 'Utrecht, Netherlands',
				organization: 'ACM',
				website: 'https://moco.org'
			}
		]
	},
	grant: {
		id: 'grant',
		name: 'Grant Deadline',
		color: '#10b981',
		icon: 'dollar-sign',
		fields: [
			{ id: 'title', label: 'Grant Name', type: 'text', placeholder: 'NSF CAREER Award' },
			{ id: 'date', label: 'Deadline', type: 'date' },
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
			{ id: 'date', label: 'Deadline', type: 'date' },
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
			{ id: 'date', label: 'Date', type: 'date' },
			{ id: 'location', label: 'Location', type: 'text', placeholder: 'Room, building, or virtual' },
			{ id: 'description', label: 'Description', type: 'textarea' },
			{ id: 'attendees', label: 'Attendees', type: 'tags', placeholder: 'Add person' }
		]
	}
};

export function getTimelineTemplate(templateType: string): TimelineTemplate {
	return timelineTemplates[templateType] || timelineTemplates.event;
}

export class TimelineService {
	private storageKey = 'things-timeline';

	getAllEvents(): TimelineEvent[] {
		try {
			const stored = localStorage.getItem(this.storageKey);
			return stored ? JSON.parse(stored) : [];
		} catch (error) {
			console.error('Failed to load timeline events:', error);
			return [];
		}
	}

	getEvent(id: string): TimelineEvent | null {
		const events = this.getAllEvents();
		return events.find(e => e.id === id) || null;
	}

	addEvent(templateType: string, eventData: Record<string, any>): TimelineEvent {
		const events = this.getAllEvents();
		const template = getTimelineTemplate(templateType);
		
		// Initialize default data based on template
		const initializedData: Record<string, any> = {};
		template.fields.forEach((field) => {
			if (field.type === 'tags') {
				initializedData[field.id] = eventData[field.id] || [];
			} else {
				initializedData[field.id] = eventData[field.id] || '';
			}
		});
		
		const event: TimelineEvent = {
			id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			templateType,
			title: initializedData.title || 'Untitled Event',
			date: initializedData.date || new Date().toISOString().split('T')[0],
			eventData: initializedData,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		events.push(event);
		this.saveEvents(events);
		return event;
	}

	updateEvent(id: string, updates: Partial<TimelineEvent>): TimelineEvent | null {
		const events = this.getAllEvents();
		const index = events.findIndex(e => e.id === id);
		
		if (index === -1) return null;

		events[index] = {
			...events[index],
			...updates,
			updatedAt: new Date().toISOString()
		};

		this.saveEvents(events);
		return events[index];
	}

	deleteEvent(id: string): boolean {
		const events = this.getAllEvents();
		const filtered = events.filter(e => e.id !== id);
		
		if (filtered.length === events.length) return false;

		this.saveEvents(filtered);
		return true;
	}

	getTemplate(templateType: string): TimelineTemplate {
		return getTimelineTemplate(templateType);
	}

	getAllTemplates(): TimelineTemplate[] {
		return Object.values(timelineTemplates);
	}

	getPredefinedOptions(templateType: string): any[] {
		const template = getTimelineTemplate(templateType);
		return template.predefinedOptions || [];
	}

	getEventsSortedByDate(): TimelineEvent[] {
		const events = this.getAllEvents();
		return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
	}

	private saveEvents(events: TimelineEvent[]): void {
		try {
			localStorage.setItem(this.storageKey, JSON.stringify(events));
		} catch (error) {
			console.error('Failed to save timeline events:', error);
		}
	}
}