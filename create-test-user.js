// Simple script to create a test user in Firebase emulator
// Run this after starting the emulators

import fetch from 'node-fetch';

async function createTestUser() {
  try {
    // Create user in Auth emulator
    const authResponse = await fetch('http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        returnSecureToken: true
      })
    });

    const authResult = await authResponse.json();
    console.log('✅ Created test user:', authResult.email);
    console.log('🔑 User ID:', authResult.localId);
    
    // Create user document in Firestore
    const firestoreResponse = await fetch(`http://localhost:8080/v1/projects/borg-2edc0/databases/(default)/documents/users/${authResult.localId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          name: { stringValue: 'Test User' },
          email: { stringValue: 'test@example.com' },
          isApproved: { booleanValue: true },
          createdAt: { timestampValue: new Date().toISOString() },
          lastLoginAt: { timestampValue: new Date().toISOString() }
        }
      })
    });

    if (firestoreResponse.ok) {
      console.log('✅ Created approved user document');
      console.log('\n🎉 Test user ready!');
      console.log('📧 Email: test@example.com');
      console.log('🔐 Password: password123');
      console.log('✅ Pre-approved and ready to use');
    }

  } catch (error) {
    console.error('❌ Error creating test user:', error);
  }
}

createTestUser();