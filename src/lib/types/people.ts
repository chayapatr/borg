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
