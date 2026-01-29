import {
	collection,
	doc,
	addDoc,
	updateDoc,
	deleteDoc,
	getDocs,
	getDoc,
	onSnapshot,
	orderBy,
	query,
	type Unsubscribe
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { WikiEntry } from '../../types/wiki';
import type { IWikiService } from '../interfaces/IWikiService';

export class FirebaseWikiService implements IWikiService {
	private readonly collectionName = 'wiki';

	async create(data: Partial<WikiEntry>): Promise<WikiEntry> {
		const wikiData = {
			title: data.title || 'Untitled',
			content: data.content || '',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			createdBy: data.createdBy || 'unknown'
		};

		const docRef = await addDoc(collection(db, this.collectionName), wikiData);
		return { ...wikiData, id: docRef.id } as WikiEntry;
	}

	async getEntry(id: string): Promise<WikiEntry | null> {
		const docRef = doc(db, this.collectionName, id);
		const docSnap = await getDoc(docRef);

		if (!docSnap.exists()) return null;

		return { ...docSnap.data(), id: docSnap.id } as WikiEntry;
	}

	async updateEntry(id: string, updates: Partial<WikiEntry>): Promise<boolean> {
		try {
			const docRef = doc(db, this.collectionName, id);

			// Filter out undefined values
			const filteredUpdates = Object.fromEntries(
				Object.entries(updates).filter(([_, value]) => value !== undefined)
			);

			await updateDoc(docRef, {
				...filteredUpdates,
				updatedAt: new Date().toISOString()
			});

			return true;
		} catch (error) {
			console.error('Failed to update wiki entry:', error);
			return false;
		}
	}

	async deleteEntry(id: string): Promise<boolean> {
		try {
			const docRef = doc(db, this.collectionName, id);
			await deleteDoc(docRef);
			return true;
		} catch (error) {
			console.error('Failed to delete wiki entry:', error);
			return false;
		}
	}

	async getAllEntries(): Promise<WikiEntry[]> {
		const q = query(collection(db, this.collectionName), orderBy('updatedAt', 'desc'));
		const snapshot = await getDocs(q);
		return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as WikiEntry);
	}

	subscribeToEntry(id: string, callback: (entry: WikiEntry | null) => void): Unsubscribe {
		const docRef = doc(db, this.collectionName, id);

		return onSnapshot(docRef, (docSnap) => {
			if (docSnap.exists()) {
				callback({ ...docSnap.data(), id: docSnap.id } as WikiEntry);
			} else {
				callback(null);
			}
		});
	}

	subscribeToAllEntries(callback: (entries: WikiEntry[]) => void): Unsubscribe {
		const q = query(collection(db, this.collectionName), orderBy('updatedAt', 'desc'));

		return onSnapshot(q, (snapshot) => {
			const entries = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as WikiEntry);
			callback(entries);
		});
	}
}
