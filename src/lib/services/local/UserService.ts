import type { User, IUserService } from '../interfaces/IUserService';

export class UserService implements IUserService {
	private storageKey = 'borg-users';

	getAllUsers(): User[] {
		try {
			const stored = localStorage.getItem(this.storageKey);
			return stored ? JSON.parse(stored) : [];
		} catch (error) {
			console.error('Failed to load users:', error);
			return [];
		}
	}

	getApprovedUsers(): User[] {
		return this.getAllUsers().filter(user => user.isApproved);
	}

	getUnapprovedUsers(): User[] {
		return this.getAllUsers().filter(user => !user.isApproved);
	}

	getCollaboratorUsers(): User[] {
		return this.getAllUsers().filter(user => 
			user.isApproved && user.userType === 'collaborator'
		);
	}

	approveUser(userId: string, userType: 'member' | 'collaborator'): boolean {
		try {
			const users = this.getAllUsers();
			const userIndex = users.findIndex(u => u.id === userId);
			
			if (userIndex === -1) return false;

			users[userIndex] = {
				...users[userIndex],
				isApproved: true,
				userType: userType,
				approvedAt: new Date().toISOString()
			};

			this.saveUsers(users);
			return true;
		} catch (error) {
			console.error('Failed to approve user:', error);
			return false;
		}
	}

	updateUserType(userId: string, userType: 'member' | 'collaborator'): boolean {
		try {
			const users = this.getAllUsers();
			const userIndex = users.findIndex(u => u.id === userId);
			
			if (userIndex === -1) return false;

			users[userIndex] = {
				...users[userIndex],
				userType: userType,
				updatedAt: new Date().toISOString()
			};

			this.saveUsers(users);
			return true;
		} catch (error) {
			console.error('Failed to update user type:', error);
			return false;
		}
	}

	getUser(userId: string): User | null {
		const users = this.getAllUsers();
		return users.find(u => u.id === userId) || null;
	}

	// Helper method to create/update user (for auth integration)
	createOrUpdateUser(userData: Partial<User> & { id: string }): User {
		const users = this.getAllUsers();
		const existingIndex = users.findIndex(u => u.id === userData.id);

		const user: User = {
			id: userData.id,
			name: userData.name || '',
			email: userData.email || '',
			photoUrl: userData.photoUrl || '',
			isApproved: userData.isApproved ?? false,
			userType: userData.userType || 'member',
			createdAt: userData.createdAt || new Date().toISOString(),
			lastLoginAt: new Date().toISOString()
		};

		if (existingIndex >= 0) {
			users[existingIndex] = { ...users[existingIndex], ...user };
		} else {
			users.push(user);
		}

		this.saveUsers(users);
		return user;
	}

	private saveUsers(users: User[]): void {
		try {
			localStorage.setItem(this.storageKey, JSON.stringify(users));
		} catch (error) {
			console.error('Failed to save users:', error);
		}
	}
}