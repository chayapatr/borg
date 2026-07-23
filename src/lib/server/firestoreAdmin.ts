// Firestore REST core: service-account auth, value (de)serialization, and the
// generic get/set/query helpers used by server routes that can't use the
// browser Firebase SDK (Cloudflare Workers has no firebase-admin support).
// Adapted from a working sibling project's src/lib/server/firestore.ts.

// ── Service-account JWT & access token ───────────────────────────────────────

interface ServiceAccount {
	project_id: string;
	client_email: string;
	private_key: string;
}

interface TokenCache {
	token: string;
	expiresAt: number;
}

// Module-level cache (lives for the lifetime of the Worker isolate)
let tokenCache: TokenCache | null = null;

export async function getAccessToken(sa: ServiceAccount): Promise<string> {
	const now = Date.now();
	if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.token;

	const iat = Math.floor(now / 1000);
	const exp = iat + 3600;

	const header = { alg: 'RS256', typ: 'JWT' };
	const payload = {
		iss: sa.client_email,
		sub: sa.client_email,
		aud: 'https://oauth2.googleapis.com/token',
		iat,
		exp,
		scope: 'https://www.googleapis.com/auth/datastore'
	};

	const enc = (obj: unknown) =>
		btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

	const signingInput = `${enc(header)}.${enc(payload)}`;

	// Import the PEM private key and sign with Web Crypto
	const pemBody = sa.private_key
		.replace(/-----BEGIN PRIVATE KEY-----/, '')
		.replace(/-----END PRIVATE KEY-----/, '')
		.replace(/\s+/g, '');
	const derBuf = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

	const key = await crypto.subtle.importKey(
		'pkcs8',
		derBuf,
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['sign']
	);

	const sigBuf = await crypto.subtle.sign(
		'RSASSA-PKCS1-v1_5',
		key,
		new TextEncoder().encode(signingInput)
	);

	const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');

	const jwt = `${signingInput}.${sig}`;

	const res = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Failed to get access token: ${text}`);
	}

	const data = (await res.json()) as { access_token: string; expires_in: number };
	tokenCache = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
	return data.access_token;
}

// ── Firestore REST helpers ────────────────────────────────────────────────────

export type FsValue =
	| { stringValue: string }
	| { integerValue: string }
	| { doubleValue: number }
	| { booleanValue: boolean }
	| { nullValue: null }
	| { arrayValue: { values?: FsValue[] } }
	| { mapValue: { fields?: Record<string, FsValue> } };

function toFsValue(v: unknown): FsValue {
	if (v === null || v === undefined) return { nullValue: null };
	if (typeof v === 'boolean') return { booleanValue: v };
	if (typeof v === 'number') {
		if (Number.isInteger(v)) return { integerValue: String(v) };
		return { doubleValue: v };
	}
	if (typeof v === 'string') return { stringValue: v };
	if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsValue) } };
	if (typeof v === 'object') {
		const fields: Record<string, FsValue> = {};
		for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
			fields[k] = toFsValue(val);
		}
		return { mapValue: { fields } };
	}
	return { stringValue: String(v) };
}

function fromFsValue(v: FsValue): unknown {
	if ('nullValue' in v) return null;
	if ('booleanValue' in v) return v.booleanValue;
	if ('integerValue' in v) return Number(v.integerValue);
	if ('doubleValue' in v) return v.doubleValue;
	if ('stringValue' in v) return v.stringValue;
	if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(fromFsValue);
	if ('mapValue' in v) {
		const out: Record<string, unknown> = {};
		for (const [k, val] of Object.entries(v.mapValue.fields ?? {})) {
			out[k] = fromFsValue(val);
		}
		return out;
	}
	return null;
}

export function fieldsToObj(fields: Record<string, FsValue>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(fields)) out[k] = fromFsValue(v);
	return out;
}

function objToFields(obj: Record<string, unknown>): Record<string, FsValue> {
	const fields: Record<string, FsValue> = {};
	for (const [k, v] of Object.entries(obj)) fields[k] = toFsValue(v);
	return fields;
}

// Borg's Firebase project uses the default Firestore database (client SDK
// calls getFirestore(app) with no database id).
const DATABASE_ID = '(default)';

export interface Db {
	projectId: string;
	sa: ServiceAccount;
}

export function getDb(serviceAccountJson: string): Db {
	// Cloudflare secrets may store the private_key with literal newlines instead of \n
	const sanitized = serviceAccountJson.replace(
		/"private_key"\s*:\s*"([\s\S]*?)(?<!\\)"/,
		(_, key) => `"private_key":"${key.replace(/\n/g, '\\n')}"`
	);
	const sa = JSON.parse(sanitized) as ServiceAccount;
	return { projectId: sa.project_id, sa };
}

export function docUrl(db: Db, collection: string, docId: string): string {
	return `https://firestore.googleapis.com/v1/projects/${db.projectId}/databases/${DATABASE_ID}/documents/${collection}/${docId}`;
}

export function collectionUrl(db: Db, collection: string): string {
	return `https://firestore.googleapis.com/v1/projects/${db.projectId}/databases/${DATABASE_ID}/documents/${collection}`;
}

export async function fsGet(
	db: Db,
	collection: string,
	docId: string
): Promise<Record<string, unknown> | null> {
	const token = await getAccessToken(db.sa);
	const res = await fetch(docUrl(db, collection, docId), {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`Firestore GET failed: ${await res.text()}`);
	const doc = (await res.json()) as { fields?: Record<string, FsValue> };
	if (!doc.fields) return null;
	return fieldsToObj(doc.fields);
}

export async function fsSet(
	db: Db,
	collection: string,
	docId: string,
	data: Record<string, unknown>,
	merge = false
): Promise<void> {
	const token = await getAccessToken(db.sa);
	const fields = objToFields(data);

	if (merge) {
		// PATCH with updateMask
		const fieldPaths = Object.keys(data)
			.map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
			.join('&');
		const res = await fetch(`${docUrl(db, collection, docId)}?${fieldPaths}`, {
			method: 'PATCH',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ fields })
		});
		if (!res.ok) throw new Error(`Firestore PATCH failed: ${await res.text()}`);
	} else {
		// Full overwrite via PATCH without mask (creates or replaces)
		const res = await fetch(docUrl(db, collection, docId), {
			method: 'PATCH',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ fields })
		});
		if (!res.ok) throw new Error(`Firestore PATCH (set) failed: ${await res.text()}`);
	}
}

export async function fsDelete(db: Db, collection: string, docId: string): Promise<void> {
	const token = await getAccessToken(db.sa);
	const res = await fetch(docUrl(db, collection, docId), {
		method: 'DELETE',
		headers: { Authorization: `Bearer ${token}` }
	});
	if (res.status === 404) return;
	if (!res.ok) throw new Error(`Firestore DELETE failed: ${await res.text()}`);
}

export async function fsUpdate(
	db: Db,
	collection: string,
	docId: string,
	data: Record<string, unknown>
): Promise<void> {
	return fsSet(db, collection, docId, data, true);
}

interface FsQueryResult {
	document?: { fields?: Record<string, FsValue>; name?: string };
}

export async function fsQuery(
	db: Db,
	collection: string,
	whereField: string,
	whereOp: string,
	whereValue: unknown
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
	const token = await getAccessToken(db.sa);

	const url = `https://firestore.googleapis.com/v1/projects/${db.projectId}/databases/${DATABASE_ID}/documents:runQuery`;

	const body = {
		structuredQuery: {
			from: [{ collectionId: collection }],
			where: {
				fieldFilter: {
					field: { fieldPath: whereField },
					op: whereOp,
					value: toFsValue(whereValue)
				}
			}
		}
	};

	const res = await fetch(url, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	if (!res.ok) throw new Error(`Firestore query failed: ${await res.text()}`);

	const results = (await res.json()) as FsQueryResult[];
	return results
		.filter((r) => r.document?.fields)
		.map((r) => {
			const name = r.document!.name ?? '';
			const id = name.split('/').pop() ?? '';
			return { id, data: fieldsToObj(r.document!.fields!) };
		});
}
