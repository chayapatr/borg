// Script to set up a test user in Firebase emulator
const admin = require('firebase-admin');

// Initialize Firebase Admin with emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({
  projectId: 'demo-borg-project',
});

const auth = admin.auth();
const firestore = admin.firestore();

async function setupTestUser() {
  try {
    // Create a test user
    const userRecord = await auth.createUser({
      uid: 'test-user-123',
      email: 'test@example.com',
      displayName: 'Test User',
      emailVerified: true,
    });

    console.log('Created test user:', userRecord.uid);

    // Create user document in Firestore with approval
    await firestore.collection('users').doc(userRecord.uid).set({
      name: 'Test User',
      email: 'test@example.com',
      createdAt: new Date(),
      isApproved: true, // Pre-approve for testing
      lastLoginAt: new Date()
    });

    console.log('Created approved user document');

    // Create some test data
    const projectRef = await firestore.collection('projects').add({
      title: 'Test Project',
      description: 'A test project for emulator testing',
      status: 'active',
      slug: 'test-project',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodeCount: 0,
      collaborators: [],
      createdBy: userRecord.uid
    });

    console.log('Created test project:', projectRef.id);

    console.log('\n✅ Test setup complete!');
    console.log('📧 Test user: test@example.com');
    console.log('🔑 Password: Use any password in emulator');
    console.log('🚀 The user is pre-approved and ready to use');

  } catch (error) {
    console.error('Error setting up test user:', error);
  }
}

setupTestUser();