import type { TimelineEvent, TimelineTemplate } from '../local/TimelineService';

export interface ITimelineService {
	getAllEvents(): Promise<TimelineEvent[]> | TimelineEvent[];
	getEvent(id: string): Promise<TimelineEvent | null> | TimelineEvent | null;
	addEvent(templateType: string, eventData: Record<string, unknown>): Promise<TimelineEvent> | TimelineEvent;
	updateEvent(id: string, updates: Partial<TimelineEvent>): Promise<TimelineEvent | null> | TimelineEvent | null;
	deleteEvent(id: string): Promise<boolean> | boolean;
	getTemplate(templateType: string): TimelineTemplate;
	getAllTemplates(): TimelineTemplate[];
	getPredefinedOptions(templateType: string): Record<string, unknown>[];
	getEventsSortedByDate(): Promise<TimelineEvent[]> | TimelineEvent[];

	// Real-time subscriptions (Firebase only)
	subscribeToEvents?(callback: (events: TimelineEvent[]) => void): () => void;
	subscribeToProjectEvents?(projectId: string, callback: (events: TimelineEvent[]) => void): () => void;
}