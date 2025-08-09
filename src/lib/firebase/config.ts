import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBlekBYI2NS_lABEd-rOqmPWypGQK40_Ec',
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'borg-2edc0.firebaseapp.com',
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'borg-2edc0',
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'borg-2edc0.firebasestorage.app',
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '414618308934',
	appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:414618308934:web:66381dd7dd242699979547',
	measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-C0W1WR7EP5'
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Connect to emulators in development
// if (import.meta.env.DEV) {
// 	try {
// 		connectFirestoreEmulator(db, 'localhost', 8080);
// 		connectAuthEmulator(auth, 'http://localhost:9099');
// 	} catch {
// 		// Emulators already connected
// 	}
// }
