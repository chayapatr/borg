export interface Person {
	id: string;
	name: string;
	email?: string;
	createdAt: string;
	updatedAt: string;
}

export class PeopleService {
	private storageKey = 'things-people';

	getAllPeople(): Person[] {
		try {
			const stored = localStorage.getItem(this.storageKey);
			console.log('people', stored);
			return stored ? JSON.parse(stored) : [];
		} catch (error) {
			console.error('Failed to load people:', error);
			return [];
		}
	}

	getPerson(id: string): Person | null {
		const people = this.getAllPeople();
		return people.find((p) => p.id === id) || null;
	}

	addPerson(data: { name: string; email?: string }): Person {
		const people = this.getAllPeople();

		const person: Person = {
			id: `person-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			name: data.name,
			email: data.email,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		people.push(person);
		this.savePeople(people);
		return person;
	}

	updatePerson(id: string, updates: Partial<Person>): Person | null {
		const people = this.getAllPeople();
		const index = people.findIndex((p) => p.id === id);

		if (index === -1) return null;

		people[index] = {
			...people[index],
			...updates,
			updatedAt: new Date().toISOString()
		};

		this.savePeople(people);
		return people[index];
	}

	deletePerson(id: string): boolean {
		const people = this.getAllPeople();
		const filtered = people.filter((p) => p.id !== id);

		if (filtered.length === people.length) return false;

		this.savePeople(filtered);
		return true;
	}

	searchPeople(query: string): Person[] {
		const people = this.getAllPeople();
		const lowercaseQuery = query.toLowerCase();

		return people.filter(
			(person) =>
				person.name.toLowerCase().includes(lowercaseQuery) ||
				person.email?.toLowerCase().includes(lowercaseQuery)
		);
	}

	private savePeople(people: Person[]): void {
		try {
			localStorage.setItem(this.storageKey, JSON.stringify(people));
		} catch (error) {
			console.error('Failed to save people:', error);
		}
	}
}
