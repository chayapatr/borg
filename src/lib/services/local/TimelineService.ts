import type { TemplateField } from '../../templates';

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
	timestamp: string; // ISO timestamp with timezone (e.g., '2024-12-25T14:00:00-05:00')
	eventData: Record<string, any>; // Dynamic data based on template
	createdAt: string;
	updatedAt: string;
	createdBy?: string; // User ID who created the event
	projectId?: string | null; // Project ID if this is a project-specific event
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
			{ id: 'timestamp', label: 'Date & Time', type: 'datetime', defaultValue: '-5' },
			{ id: 'venue', label: 'Venue', type: 'text', placeholder: 'Location or virtual' },
			{ id: 'submissionDeadline', label: 'Submission Deadline', type: 'date' },
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
			{ id: 'timestamp', label: 'Date & Time', type: 'datetime', defaultValue: '-5' },
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
			if (!stored) return [];
			
			const rawEvents = JSON.parse(stored);
			
			// Migrate legacy events on load (read-only migration)
			return rawEvents.map((event: any) => this.migrateEvent(event));
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
				initializedData[field.id] = eventData[field.id] || field.defaultValue || '';
			}
		});
		
		const event: TimelineEvent = {
			id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			templateType,
			title: initializedData.title || 'Untitled Event',
			timestamp: initializedData.timestamp || new Date().toISOString(), // Default to now
			eventData: initializedData,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		events.push(event);
		this.saveEvents(events);
		return event;
	}

	updateEvent(id: string, updates: Partial<TimelineEvent>): TimelineEvent | null {
		const rawStored = localStorage.getItem(this.storageKey);
		if (!rawStored) return null;
		
		const rawEvents = JSON.parse(rawStored);
		const index = rawEvents.findIndex((e: any) => e.id === id);
		
		if (index === -1) return null;

		// Migrate the event to new format when updating
		const migratedEvent = this.migrateEvent(rawEvents[index]);
		
		// Apply updates
		const updatedEvent = {
			...migratedEvent,
			...updates,
			updatedAt: new Date().toISOString()
		};

		// Clean up old fields when saving
		const cleanEvent = this.cleanupLegacyFields(updatedEvent);
		rawEvents[index] = cleanEvent;

		this.saveEvents(rawEvents);
		return updatedEvent;
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
		return this.getAllEvents();
	}

	// Migration helper: Convert legacy event to new timestamp format
	public migrateEvent(event: any): TimelineEvent {
		if (event.timestamp) {
			// Already in new format, return as is
			return event as TimelineEvent;
		}

		// Legacy event with separate date/time/timezone fields
		let timestamp: string;
		
		if (event.date && event.time && event.timezone) {
			// Has all three fields - create proper timestamp
			const timezoneOffset = this.parseTimezoneOffset(event.timezone);
			const offsetString = timezoneOffset >= 0 ? 
				`+${Math.abs(timezoneOffset).toString().padStart(2, '0')}:00` : 
				`-${Math.abs(timezoneOffset).toString().padStart(2, '0')}:00`;
			timestamp = `${event.date}T${event.time}${offsetString}`;
		} else if (event.date && event.time) {
			// Has date and time but no timezone - assume ET
			timestamp = `${event.date}T${event.time}-05:00`;
		} else if (event.date) {
			// Only has date - use end of day with ET timezone
			timestamp = `${event.date}T23:59-05:00`;
		} else {
			// No date info - use current time without seconds
			const now = new Date();
			const dateStr = now.toISOString().split('T')[0];
			const timeStr = now.toTimeString().slice(0, 5);
			timestamp = `${dateStr}T${timeStr}-05:00`;
		}

		// Create migrated event
		const migratedEvent: TimelineEvent = {
			id: event.id,
			templateType: event.templateType,
			title: event.title,
			timestamp,
			eventData: event.eventData || {},
			createdAt: event.createdAt,
			updatedAt: new Date().toISOString(), // Update timestamp for migration
			createdBy: event.createdBy,
			projectId: event.projectId
		};

		return migratedEvent;
	}

	// Helper to parse timezone offset from various formats
	private parseTimezoneOffset(timezone: string): number {
		if (typeof timezone === 'string') {
			// Handle formats like "-5 (ET)", "-5", "America/New_York"
			const offsetMatch = timezone.match(/^([+-]?\d+)/);
			if (offsetMatch) {
				return parseInt(offsetMatch[1]);
			}
			
			// Handle timezone names
			const timezoneMap: Record<string, number> = {
				'America/New_York': -5,
				'America/Chicago': -6,
				'America/Denver': -7,
				'America/Los_Angeles': -8,
				'America/Phoenix': -7,
				'Pacific/Honolulu': -10
			};
			
			return timezoneMap[timezone] || -5; // Default to ET
		}
		
		return -5; // Default to ET
	}

	// Clean up legacy fields when saving migrated events
	private cleanupLegacyFields(event: TimelineEvent): TimelineEvent {
		const cleaned = { ...event };
		
		// Remove old date/time/timezone fields if they exist
		delete (cleaned as any).date;
		delete (cleaned as any).time;
		delete (cleaned as any).timezone;
		
		return cleaned;
	}

	private saveEvents(events: TimelineEvent[]): void {
		try {
			localStorage.setItem(this.storageKey, JSON.stringify(events));
		} catch (error) {
			console.error('Failed to save timeline events:', error);
		}
	}
}