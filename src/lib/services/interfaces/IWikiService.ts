import type { WikiEntry } from '../../types/wiki';

export interface IWikiService {
	create(data: Partial<WikiEntry>): Promise<WikiEntry> | WikiEntry;
	getEntry(id: string): Promise<WikiEntry | null> | WikiEntry | null;
	updateEntry(id: string, updates: Partial<WikiEntry>): Promise<boolean> | boolean;
	deleteEntry(id: string): Promise<boolean> | boolean;
	getAllEntries(): Promise<WikiEntry[]> | WikiEntry[];

	// Real-time subscriptions (Firebase only)
	subscribeToEntry?(id: string, callback: (entry: WikiEntry | null) => void): () => void;
	subscribeToAllEntries?(callback: (entries: WikiEntry[]) => void): () => void;
}
