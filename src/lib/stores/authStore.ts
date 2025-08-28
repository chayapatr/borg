import { writable } from 'svelte/store';
import type { User } from 'firebase/auth';
import { FirebaseAuth } from '../services/firebase/FirebaseAuth';

interface AuthState {
	user: User | null;
	isApproved: boolean;
	userType: 'member' | 'collaborator' | null;
	loading: boolean;
	error: string | null;
}

const initialState: AuthState = {
	user: null,
	isApproved: false,
	userType: null,
	loading: true,
	error: null
};

export const authStore = writable<AuthState>(initialState);

// Initialize Firebase Auth
const firebaseAuth = new FirebaseAuth();

// Listen to auth state changes
firebaseAuth.onAuthStateChange(async (user) => {
	if (user) {
		// Check approval status and user data
		const isApproved = await firebaseAuth.checkUserApproval(user.uid);
		const userData = await firebaseAuth.getUserData(user.uid);
		const userType = userData?.userType || 'member';
		authStore.set({ user, isApproved, userType, loading: false, error: null });
	} else {
		authStore.set({ user: null, isApproved: false, userType: null, loading: false, error: null });
	}
});

export { firebaseAuth };