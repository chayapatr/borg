export interface User {
	id: string;
	name: string;
	email: string;
	photoUrl: string;
	isApproved: boolean;
	userType: 'member' | 'collaborator';
	createdAt: Date | string;
	lastLoginAt: Date | string;
}

export interface IUserService {
	getAllUsers(): Promise<User[]> | User[];
	getApprovedUsers(): Promise<User[]> | User[];
	getUnapprovedUsers(): Promise<User[]> | User[];
	getCollaboratorUsers(): Promise<User[]> | User[]; // For project invitation dropdown
	approveUser(userId: string, userType: 'member' | 'collaborator'): Promise<boolean> | boolean;
	updateUserType(userId: string, userType: 'member' | 'collaborator'): Promise<boolean> | boolean;
	getUser(userId: string): Promise<User | null> | User | null;
}