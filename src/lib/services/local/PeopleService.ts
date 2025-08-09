export interface Person {
	id: string;
	name: string;
	email?: string;
	photoUrl?: string;
	createdAt: string;
	updatedAt: string;
}

export interface GlobalPerson extends Person {
	lastUsedAt: string;
	usageCount: number;
}

export class PeopleService {
	private readonly GLOBAL_PEOPLE_KEY = 'borg-people-global';
	private migrationCompleted = false;

	constructor() {
		this.ensureMigration();
	}

	// Migration: Move global people to new schema
	private ensureMigration(): void {
		if (this.migrationCompleted || localStorage.getItem(`${this.GLOBAL_PEOPLE_KEY}-migrated`)) {
			this.migrationCompleted = true;
			return;
		}

		console.log('Migrating people to new schema...');
		const oldStorageKey = 'things-people';
		const oldPeople = this.getOldPeople(oldStorageKey);

		// Migrate to global people index
		if (oldPeople.length > 0) {
			const globalPeople: GlobalPerson[] = oldPeople.map((person) => ({
				...person,
				lastUsedAt: person.updatedAt,
				usageCount: 1
			}));
			this.saveGlobalPeople(globalPeople);

			// Clear old storage
			localStorage.removeItem(oldStorageKey);
		}

		localStorage.setItem(`${this.GLOBAL_PEOPLE_KEY}-migrated`, 'true');
		this.migrationCompleted = true;
		console.log(`Migrated ${oldPeople.length} people to new schema`);
	}

	private getOldPeople(storageKey: string): Person[] {
		try {
			const stored = localStorage.getItem(storageKey);
			return stored ? JSON.parse(stored) : [];
		} catch (error) {
			console.error('Failed to load old people:', error);
			return [];
		}
	}

	// Get project-scoped people storage key
	private getProjectPeopleKey(projectSlug: string): string {
		return `borg-people-${projectSlug}`;
	}

	// Get all people for a specific project
	getProjectPeople(projectSlug: string): Person[] {
		try {
			const storageKey = this.getProjectPeopleKey(projectSlug);
			const stored = localStorage.getItem(storageKey);
			return stored ? JSON.parse(stored) : [];
		} catch (error) {
			console.error('Failed to load project people:', error);
			return [];
		}
	}

	// Save people for a specific project
	private saveProjectPeople(projectSlug: string, people: Person[]): void {
		try {
			const storageKey = this.getProjectPeopleKey(projectSlug);
			localStorage.setItem(storageKey, JSON.stringify(people));
		} catch (error) {
			console.error('Failed to save project people:', error);
		}
	}

	// Get global people index
	getGlobalPeople(): GlobalPerson[] {
		try {
			const stored = localStorage.getItem(this.GLOBAL_PEOPLE_KEY);
			return stored ? JSON.parse(stored) : [];
		} catch (error) {
			console.error('Failed to load global people:', error);
			return [];
		}
	}

	// Save global people index
	private saveGlobalPeople(people: GlobalPerson[]): void {
		try {
			localStorage.setItem(this.GLOBAL_PEOPLE_KEY, JSON.stringify(people));
		} catch (error) {
			console.error('Failed to save global people:', error);
		}
	}

	// Get person by ID from a specific project
	getPerson(personId: string, projectSlug?: string): Person | null {
		if (projectSlug) {
			// Look in specific project
			const projectPeople = this.getProjectPeople(projectSlug);
			return projectPeople.find((p) => p.id === personId) || null;
		}

		// Look in global index
		const globalPeople = this.getGlobalPeople();
		const globalPerson = globalPeople.find((p) => p.id === personId);
		if (globalPerson) {
			return {
				id: globalPerson.id,
				name: globalPerson.name,
				email: globalPerson.email,
				createdAt: globalPerson.createdAt,
				updatedAt: globalPerson.updatedAt
			};
		}

		return null;
	}

	// Add person to a specific project
	addPersonToProject(projectSlug: string, data: { name: string; email?: string }): Person {
		const projectPeople = this.getProjectPeople(projectSlug);

		// Check if person already exists in this project
		const existingPerson = projectPeople.find(
			(p) => p.name.toLowerCase() === data.name.toLowerCase() && p.email === data.email
		);
		if (existingPerson) {
			return existingPerson;
		}

		// Create new person
		const person: Person = {
			id: `person-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			name: data.name,
			email: data.email,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		// Add to project
		projectPeople.push(person);
		this.saveProjectPeople(projectSlug, projectPeople);

		// Update global index
		this.updateGlobalPeopleIndex(person);

		return person;
	}

	// Update person in a specific project
	updatePersonInProject(
		projectSlug: string,
		personId: string,
		updates: Partial<Person>
	): Person | null {
		const projectPeople = this.getProjectPeople(projectSlug);
		const index = projectPeople.findIndex((p) => p.id === personId);

		if (index === -1) return null;

		projectPeople[index] = {
			...projectPeople[index],
			...updates,
			updatedAt: new Date().toISOString()
		};

		this.saveProjectPeople(projectSlug, projectPeople);

		// Update global index
		this.updateGlobalPeopleIndex(projectPeople[index]);

		return projectPeople[index];
	}

	// Delete person from a specific project
	deletePersonFromProject(projectSlug: string, personId: string): boolean {
		const projectPeople = this.getProjectPeople(projectSlug);
		const filtered = projectPeople.filter((p) => p.id !== personId);

		if (filtered.length === projectPeople.length) return false;

		this.saveProjectPeople(projectSlug, filtered);
		return true;
	}

	// Search people in a specific project
	searchProjectPeople(projectSlug: string, query: string): Person[] {
		const people = this.getProjectPeople(projectSlug);
		const lowercaseQuery = query.toLowerCase();

		return people.filter(
			(person) =>
				person.name.toLowerCase().includes(lowercaseQuery) ||
				person.email?.toLowerCase().includes(lowercaseQuery)
		);
	}

	// Search people globally (for autocomplete)
	searchGlobalPeople(query: string): GlobalPerson[] {
		const people = this.getGlobalPeople();
		const lowercaseQuery = query.toLowerCase();

		return people
			.filter(
				(person) =>
					person.name.toLowerCase().includes(lowercaseQuery) ||
					person.email?.toLowerCase().includes(lowercaseQuery)
			)
			.sort((a, b) => b.usageCount - a.usageCount) // Sort by usage
			.slice(0, 10); // Limit results
	}

	// Update global people index when person is used
	private updateGlobalPeopleIndex(person: Person): void {
		const globalPeople = this.getGlobalPeople();
		const existingIndex = globalPeople.findIndex(
			(p) => p.name.toLowerCase() === person.name.toLowerCase() && p.email === person.email
		);

		if (existingIndex >= 0) {
			// Update existing entry
			globalPeople[existingIndex] = {
				...globalPeople[existingIndex],
				name: person.name, // Update name in case it changed
				email: person.email,
				updatedAt: person.updatedAt,
				lastUsedAt: new Date().toISOString(),
				usageCount: globalPeople[existingIndex].usageCount + 1
			};
		} else {
			// Add new entry
			const globalPerson: GlobalPerson = {
				...person,
				lastUsedAt: new Date().toISOString(),
				usageCount: 1
			};
			globalPeople.push(globalPerson);
		}

		this.saveGlobalPeople(globalPeople);
	}

	// Legacy method for backward compatibility (searches all projects)
	getAllPeople(): Person[] {
		// This is now inefficient but kept for backward compatibility
		// In the new schema, you should use getProjectPeople() or getGlobalPeople()
		const globalPeople = this.getGlobalPeople();
		return globalPeople.map((gp) => ({
			id: gp.id,
			name: gp.name,
			email: gp.email,
			createdAt: gp.createdAt,
			updatedAt: gp.updatedAt
		}));
	}

	// Legacy method for backward compatibility
	addPerson(data: { name: string; email?: string }): Person {
		// This method is deprecated - use addPersonToProject instead
		console.warn('PeopleService.addPerson() is deprecated. Use addPersonToProject() instead.');

		// For backward compatibility, add to a default "global" project
		return this.addPersonToProject('global', data);
	}

	// Legacy method for backward compatibility
	updatePerson(id: string, updates: Partial<Person>): Person | null {
		// This method is deprecated - use updatePersonInProject instead
		console.warn(
			'PeopleService.updatePerson() is deprecated. Use updatePersonInProject() instead.'
		);

		// Try to update in default "global" project
		return this.updatePersonInProject('global', id, updates);
	}

	// Legacy method for backward compatibility
	deletePerson(id: string): boolean {
		// This method is deprecated - use deletePersonFromProject instead
		console.warn(
			'PeopleService.deletePerson() is deprecated. Use deletePersonFromProject() instead.'
		);

		// Try to delete from default "global" project
		return this.deletePersonFromProject('global', id);
	}

	// Legacy method for backward compatibility
	searchPeople(query: string): Person[] {
		// This method is deprecated - use searchProjectPeople or searchGlobalPeople instead
		console.warn(
			'PeopleService.searchPeople() is deprecated. Use searchProjectPeople() or searchGlobalPeople() instead.'
		);

		const globalResults = this.searchGlobalPeople(query);
		return globalResults.map((gp) => ({
			id: gp.id,
			name: gp.name,
			email: gp.email,
			createdAt: gp.createdAt,
			updatedAt: gp.updatedAt
		}));
	}
}
