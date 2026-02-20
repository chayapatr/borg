import type { Person, GlobalPerson } from '../../types/people';

export interface IPeopleService {
	getProjectPeople(projectSlug: string): Promise<Person[]> | Person[];
	getGlobalPeople(): Promise<GlobalPerson[]> | GlobalPerson[];
	getPerson(personId: string, projectSlug?: string): Promise<Person | null> | Person | null;
	addPersonToProject(projectSlug: string, data: { name: string; email?: string }): Promise<Person> | Person;
	updatePersonInProject(projectSlug: string, personId: string, updates: Partial<Person>): Promise<Person | null> | Person | null;
	deletePersonFromProject(projectSlug: string, personId: string): Promise<boolean> | boolean;
	searchProjectPeople(projectSlug: string, query: string): Promise<Person[]> | Person[];
	searchGlobalPeople(query: string): Promise<GlobalPerson[]> | GlobalPerson[];
	
	// Legacy methods for backward compatibility
	getAllPeople(): Promise<Person[]> | Person[];
	addPerson(data: { name: string; email?: string }): Promise<Person> | Person;
	updatePerson(id: string, updates: Partial<Person>): Promise<Person | null> | Person | null;
	deletePerson(id: string): Promise<boolean> | boolean;
	searchPeople(query: string): Promise<Person[]> | Person[];

	// Real-time subscriptions (Firebase only)
	subscribeToProjectPeople?(projectSlug: string, callback: (people: Person[]) => void): () => void;
}