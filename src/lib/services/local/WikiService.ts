import type { WikiEntry } from '../../types/wiki';
import type { IWikiService } from '../interfaces/IWikiService';

const STORAGE_KEY = 'borg-wiki';

export class WikiService implements IWikiService {
	private getEntries(): WikiEntry[] {
		if (typeof window === 'undefined') return [];
		const data = localStorage.getItem(STORAGE_KEY);
		return data ? JSON.parse(data) : [];
	}

	private saveEntries(entries: WikiEntry[]): void {
		if (typeof window === 'undefined') return;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
	}

	private generateId(): string {
		return `wiki-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
	}

	create(data: Partial<WikiEntry>): WikiEntry {
		const entries = this.getEntries();
		const newEntry: WikiEntry = {
			id: this.generateId(),
			title: data.title || 'Untitled',
			content: data.content || '',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			createdBy: data.createdBy || 'local'
		};

		entries.push(newEntry);
		this.saveEntries(entries);
		return newEntry;
	}

	getEntry(id: string): WikiEntry | null {
		const entries = this.getEntries();
		return entries.find((e) => e.id === id) || null;
	}

	updateEntry(id: string, updates: Partial<WikiEntry>): boolean {
		const entries = this.getEntries();
		const index = entries.findIndex((e) => e.id === id);

		if (index === -1) return false;

		entries[index] = {
			...entries[index],
			...updates,
			updatedAt: new Date().toISOString()
		};

		this.saveEntries(entries);
		return true;
	}

	deleteEntry(id: string): boolean {
		const entries = this.getEntries();
		const index = entries.findIndex((e) => e.id === id);

		if (index === -1) return false;

		entries.splice(index, 1);
		this.saveEntries(entries);
		return true;
	}

	getAllEntries(): WikiEntry[] {
		return this.getEntries().sort(
			(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
		);
	}
}
