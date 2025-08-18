import { 
	collection, 
	doc, 
	addDoc, 
	updateDoc, 
	deleteDoc, 
	getDocs, 
	query, 
	orderBy, 
	onSnapshot,
	deleteField,
	type Unsubscribe 
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { TimelineEvent, TimelineTemplate } from '../local/TimelineService';
import { getTimelineTemplate, timelineTemplates, TimelineService } from '../local/TimelineService';
import type { ITimelineService } from '../interfaces';
import { get } from 'svelte/store';
import { authStore } from '../../stores/authStore';

export class FirebaseTimelineService implements ITimelineService {
	private projectId?: string;
	private localService: TimelineService;

	constructor(projectId?: string) {
		this.projectId = projectId;
		this.localService = new TimelineService();
	}

	async getAllEvents(): Promise<TimelineEvent[]> {
		const userId = get(authStore).user?.uid;
		if (!userId) {
			throw new Error('User must be authenticated to access timeline');
		}
		
		const collectionPath = this.projectId 
			? `projects/${this.projectId}/timeline`
			: 'timeline';
			
		// Get all events without ordering
		const snapshot = await getDocs(collection(db, collectionPath));
		
		console.log('FirebaseTimelineService: Found', snapshot.docs.length, 'events');
		
		// Migrate legacy events when loading
		const migratedEvents = snapshot.docs.map(doc => {
			const rawData = { ...doc.data(), id: doc.id };
			console.log('Raw event data:', rawData);
			const migrated = this.localService.migrateEvent(rawData);
			console.log('Migrated event:', migrated);
			return migrated;
		});
		
		console.log('Returning', migratedEvents.length, 'migrated events');
		return migratedEvents;
	}

	async getEvent(id: string): Promise<TimelineEvent | null> {
		const events = await this.getAllEvents();
		return events.find(e => e.id === id) || null;
	}

	async addEvent(templateType: string, eventData: Record<string, unknown>): Promise<TimelineEvent> {
		const template = getTimelineTemplate(templateType);
		
		// Initialize default data based on template
		const initializedData: Record<string, unknown> = {};
		template.fields.forEach((field) => {
			if (field.type === 'tags') {
				initializedData[field.id] = eventData[field.id] || [];
			} else {
				initializedData[field.id] = eventData[field.id] || '';
			}
		});

		const userId = get(authStore).user?.uid;
		if (!userId) {
			throw new Error('User must be authenticated to create timeline events');
		}
		
		const collectionPath = this.projectId 
			? `projects/${this.projectId}/timeline`
			: 'timeline';
		
		const eventDoc = {
			templateType,
			title: (initializedData.title as string) || 'Untitled Event',
			timestamp: (initializedData.timestamp as string) || new Date().toISOString(),
			eventData: initializedData,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			createdBy: userId,
			projectId: this.projectId || null
		};

		const docRef = await addDoc(collection(db, collectionPath), eventDoc);
		
		return {
			id: docRef.id,
			...eventDoc
		} as TimelineEvent;
	}

	async updateEvent(id: string, updates: Partial<TimelineEvent>): Promise<TimelineEvent | null> {
		const userId = get(authStore).user?.uid;
		if (!userId) {
			throw new Error('User must be authenticated to update timeline events');
		}
		
		const collectionPath = this.projectId 
			? `projects/${this.projectId}/timeline`
			: 'timeline';
			
		const eventRef = doc(db, collectionPath, id);
		
		// Clean up legacy fields when updating
		const cleanUpdates = {
			...updates,
			updatedAt: new Date().toISOString()
		};
		
		// Remove old fields from Firestore when updating
		const updateData: any = { ...cleanUpdates };
		updateData.date = deleteField(); // This will delete the field in Firestore
		updateData.time = deleteField();
		updateData.timezone = deleteField();
		
		await updateDoc(eventRef, updateData);
		
		// Return updated event
		const events = await this.getAllEvents();
		return events.find(e => e.id === id) || null;
	}

	async deleteEvent(id: string): Promise<boolean> {
		try {
			const userId = get(authStore).user?.uid;
			if (!userId) {
				throw new Error('User must be authenticated to delete timeline events');
			}
			
			const collectionPath = this.projectId 
				? `projects/${this.projectId}/timeline`
				: 'timeline';
				
			await deleteDoc(doc(db, collectionPath, id));
			return true;
		} catch (error) {
			console.error('Failed to delete timeline event:', error);
			return false;
		}
	}

	getTemplate(templateType: string): TimelineTemplate {
		return getTimelineTemplate(templateType);
	}

	getAllTemplates(): TimelineTemplate[] {
		return Object.values(timelineTemplates);
	}

	getPredefinedOptions(templateType: string): Record<string, unknown>[] {
		const template = getTimelineTemplate(templateType);
		return template.predefinedOptions || [];
	}

	async getEventsSortedByDate(): Promise<TimelineEvent[]> {
		return this.getAllEvents(); // Already sorted by date in getAllEvents
	}

	subscribeToEvents(callback: (events: TimelineEvent[]) => void): Unsubscribe {
		const userId = get(authStore).user?.uid;
		if (!userId) {
			throw new Error('User must be authenticated to subscribe to timeline events');
		}
		
		const collectionPath = this.projectId 
			? `projects/${this.projectId}/timeline`
			: 'timeline';
			
		const q = query(collection(db, collectionPath), orderBy('date', 'asc'));
		
		return onSnapshot(q, (snapshot) => {
			const events = snapshot.docs.map(doc => ({
				...doc.data(),
				id: doc.id
			} as TimelineEvent));
			callback(events);
		});
	}

	subscribeToProjectEvents(projectId: string, callback: (events: TimelineEvent[]) => void): Unsubscribe {
		const q = query(
			collection(db, `projects/${projectId}/timeline`), 
			orderBy('date', 'asc')
		);
		
		return onSnapshot(q, (snapshot) => {
			const events = snapshot.docs.map(doc => ({
				...doc.data(),
				id: doc.id
			} as TimelineEvent));
			callback(events);
		});
	}
}