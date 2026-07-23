// Verifies Outline's webhook signature.
// Header format: "Outline-Signature: t=<unix-ms-timestamp>,s=<hex-hmac-sha256>"
// Signed data: `${timestamp}.${rawBody}`, HMAC-SHA256 keyed by the webhook secret.

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

function toHex(buffer: ArrayBuffer): string {
	return Array.from(new Uint8Array(buffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export async function verifyOutlineSignature(
	signatureHeader: string | null,
	rawBody: string,
	secret: string
): Promise<boolean> {
	if (!signatureHeader) return false;

	const parts = Object.fromEntries(
		signatureHeader.split(',').map((kv) => {
			const [k, v] = kv.split('=');
			return [k.trim(), v?.trim() ?? ''];
		})
	);
	const timestamp = parts['t'];
	const signature = parts['s'];
	if (!timestamp || !signature) return false;

	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);

	const signedData = `${timestamp}.${rawBody}`;
	const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedData));
	const expected = toHex(digest);

	return timingSafeEqual(expected, signature);
}
