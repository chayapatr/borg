// Verifies Firebase Auth ID tokens against Google's public JWKS.
// Uses `jose` (WebCrypto-native, Workers-compatible) rather than firebase-admin,
// since firebase-admin isn't compatible with the Cloudflare Workers runtime.
import { jwtVerify, createRemoteJWKSet } from 'jose';

const JWKS_URL =
	'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const ISSUER_PREFIX = 'https://securetoken.google.com/';

// Module-level: reused across requests within the same Worker isolate, and
// createRemoteJWKSet has its own internal fetch + key caching.
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

export interface VerifiedFirebaseUser {
	uid: string;
	email?: string;
}

export async function verifyFirebaseIdToken(
	idToken: string,
	projectId: string
): Promise<VerifiedFirebaseUser> {
	const { payload } = await jwtVerify(idToken, JWKS, {
		issuer: ISSUER_PREFIX + projectId,
		audience: projectId
	});

	if (!payload.sub) throw new Error('ID token missing subject');

	return { uid: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined };
}
