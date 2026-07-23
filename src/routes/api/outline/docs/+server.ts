import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { createCollection, createDocument, getCollection } from '$lib/server/outlineApi';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return error(401, 'Unauthorized');
	}

	const { projectSlug, projectTitle, existingCollectionId, title } = await request.json();
	if (!projectSlug || !title) {
		return error(400, 'projectSlug and title are required');
	}

	const apiUrl = env.OUTLINE_API_URL;
	const apiToken = env.OUTLINE_API_TOKEN;
	if (!apiUrl || !apiToken) {
		return error(500, 'Outline integration is not configured');
	}
	const outlineConfig = { apiUrl, apiToken };

	// Reuse the project's existing Outline collection if it still exists,
	// otherwise create one (lazy, same pattern as the doc itself).
	let collection = existingCollectionId ? await getCollection(outlineConfig, existingCollectionId) : null;
	if (!collection) {
		collection = await createCollection(outlineConfig, projectTitle || projectSlug);
	}

	const doc = await createDocument(outlineConfig, {
		title,
		collectionId: collection.id
	});

	return json({ id: doc.id, url: doc.url, title: doc.title, collectionId: collection.id });
};
