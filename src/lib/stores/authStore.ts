import { writable } from 'svelte/store';
import type { User } from 'firebase/auth';
import { FirebaseAuth } from '../services/firebase/FirebaseAuth';

interface AuthState {
	user: User | null;
	isApproved: boolean;
	loading: boolean;
	error: string | null;
}

const initialState: AuthState = {
	user: null,
	isApproved: false,
	loading: true,
	error: null
};

export const authStore = writable<AuthState>(initialState);

// Initialize Firebase Auth
const firebaseAuth = new FirebaseAuth();

// Listen to auth state changes
firebaseAuth.onAuthStateChange(async (user) => {
	if (user) {
		// Check approval status
		const isApproved = await firebaseAuth.checkUserApproval(user.uid);
		authStore.set({ user, isApproved, loading: false, error: null });
	} else {
		authStore.set({ user: null, isApproved: false, loading: false, error: null });
	}
});

export { firebaseAuth };