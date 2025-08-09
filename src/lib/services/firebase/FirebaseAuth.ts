import { 
	signInWithPopup, 
	GoogleAuthProvider, 
	signOut as firebaseSignOut,
	onAuthStateChanged,
	type User 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';

export class FirebaseAuth {
	private currentUser: User | null = null;
	private authCallbacks: ((user: User | null) => void)[] = [];

	constructor() {
		onAuthStateChanged(auth, async (user) => {
			this.currentUser = user;
			
			if (user) {
				// Create/update user document
				await this.createUserDocument(user);
			}
			
			// Notify subscribers
			this.authCallbacks.forEach(callback => callback(user));
		});
	}

	async signInWithGoogle(): Promise<{ user: User; isApproved: boolean }> {
		const provider = new GoogleAuthProvider();
		const result = await signInWithPopup(auth, provider);
		
		// Check if user is approved
		const isApproved = await this.checkUserApproval(result.user.uid);
		
		return { user: result.user, isApproved };
	}

	async signOut(): Promise<void> {
		await firebaseSignOut(auth);
	}

	private async createUserDocument(user: User): Promise<void> {
		const userRef = doc(db, 'users', user.uid);
		const userDoc = await getDoc(userRef);
		
		if (!userDoc.exists()) {
			await setDoc(userRef, {
				name: user.displayName || '',
				email: user.email || '',
				photoUrl: user.photoURL || '',
				createdAt: new Date(),
				isApproved: false, // Must be manually approved
				lastLoginAt: new Date()
			});
		} else {
			// Update last login and sync photoUrl if it has changed
			const userData = userDoc.data();
			const updateData: any = { lastLoginAt: new Date() };
			
			// Only update photoUrl if it has changed
			if (userData?.photoUrl !== user.photoURL) {
				updateData.photoUrl = user.photoURL || '';
			}
			
			await setDoc(userRef, updateData, { merge: true });
		}
	}

	async checkUserApproval(userId: string): Promise<boolean> {
		const userRef = doc(db, 'users', userId);
		const userDoc = await getDoc(userRef);
		return userDoc.exists() ? userDoc.data()?.isApproved === true : false;
	}

	getCurrentUser(): User | null {
		return this.currentUser;
	}

	onAuthStateChange(callback: (user: User | null) => void): () => void {
		this.authCallbacks.push(callback);
		return () => {
			const index = this.authCallbacks.indexOf(callback);
			if (index > -1) this.authCallbacks.splice(index, 1);
		};
	}
}