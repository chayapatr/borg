import {
	collection,
	doc,
	getDocs,
	getDoc,
	updateDoc,
	query,
	where,
	orderBy
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { User, IUserService } from '../interfaces/IUserService';

export class FirebaseUserService implements IUserService {
	async getAllUsers(): Promise<User[]> {
		const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
		const snapshot = await getDocs(q);
		return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as User);
	}

	async getApprovedUsers(): Promise<User[]> {
		const q = query(
			collection(db, 'users'), 
			where('isApproved', '==', true),
			orderBy('name', 'asc')
		);
		const snapshot = await getDocs(q);
		return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as User);
	}

	async getUnapprovedUsers(): Promise<User[]> {
		const q = query(
			collection(db, 'users'), 
			where('isApproved', '==', false),
			orderBy('createdAt', 'desc')
		);
		const snapshot = await getDocs(q);
		return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as User);
	}

	async getCollaboratorUsers(): Promise<User[]> {
		const q = query(
			collection(db, 'users'),
			where('isApproved', '==', true),
			where('userType', '==', 'collaborator'),
			orderBy('name', 'asc')
		);
		const snapshot = await getDocs(q);
		return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as User);
	}

	async approveUser(userId: string, userType: 'member' | 'collaborator'): Promise<boolean> {
		try {
			const userRef = doc(db, 'users', userId);
			await updateDoc(userRef, {
				isApproved: true,
				userType: userType,
				approvedAt: new Date()
			});
			return true;
		} catch (error) {
			console.error('Failed to approve user:', error);
			return false;
		}
	}

	async updateUserType(userId: string, userType: 'member' | 'collaborator'): Promise<boolean> {
		try {
			const userRef = doc(db, 'users', userId);
			await updateDoc(userRef, {
				userType: userType,
				updatedAt: new Date()
			});
			return true;
		} catch (error) {
			console.error('Failed to update user type:', error);
			return false;
		}
	}

	async getUser(userId: string): Promise<User | null> {
		try {
			const userRef = doc(db, 'users', userId);
			const userDoc = await getDoc(userRef);
			return userDoc.exists() ? ({ ...userDoc.data(), id: userDoc.id } as User) : null;
		} catch (error) {
			console.error('Failed to get user:', error);
			return null;
		}
	}
}