// Thin wrapper around Outline's REST API. Used by both the doc-creation route
// and (later) the comment-webhook bridge — one place that talks to Outline.

export interface OutlineConfig {
	apiUrl: string;
	apiToken: string;
}

async function outlineFetch(config: OutlineConfig, endpoint: string, body: Record<string, unknown>) {
	const res = await fetch(`${config.apiUrl}/api/${endpoint}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${config.apiToken}`
		},
		body: JSON.stringify(body)
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Outline API ${endpoint} failed (${res.status}): ${text}`);
	}

	return res.json();
}

export async function createCollection(config: OutlineConfig, name: string) {
	const json = await outlineFetch(config, 'collections.create', { name });
	return json.data as { id: string; name: string };
}

export async function getCollection(config: OutlineConfig, id: string) {
	try {
		const json = await outlineFetch(config, 'collections.info', { id });
		return json.data as { id: string; name: string };
	} catch {
		return null;
	}
}

export async function createDocument(
	config: OutlineConfig,
	params: { title: string; collectionId: string; text?: string }
) {
	const json = await outlineFetch(config, 'documents.create', {
		title: params.title,
		collectionId: params.collectionId,
		text: params.text ?? '',
		publish: true
	});
	return json.data as { id: string; url: string; title: string };
}

export async function getDocument(config: OutlineConfig, id: string) {
	const json = await outlineFetch(config, 'documents.info', { id });
	return json.data as { id: string; url: string; title: string };
}

export async function createComment(
	config: OutlineConfig,
	params: { documentId: string; text: string; parentCommentId?: string }
) {
	const json = await outlineFetch(config, 'comments.create', {
		documentId: params.documentId,
		text: params.text,
		...(params.parentCommentId && { parentCommentId: params.parentCommentId })
	});
	return json.data as { id: string };
}
