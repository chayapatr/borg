import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { searchDocuments, listDocuments } from '$lib/server/outlineApi';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return error(401, 'Unauthorized');
	}

	const apiUrl = env.OUTLINE_API_URL;
	const apiToken = env.OUTLINE_API_TOKEN;
	if (!apiUrl || !apiToken) {
		return error(500, 'Outline integration is not configured');
	}
	const outlineConfig = { apiUrl, apiToken };

	const query = url.searchParams.get('q')?.trim();
	const collectionIds = url.searchParams.getAll('collectionId');

	if (query) {
		const docs = await searchDocuments(outlineConfig, query);
		return json({ docs });
	}

	// No query: list docs across the given project collections, most
	// recently updated first.
	const perCollection = await Promise.all(
		collectionIds.map((id) =>
			listDocuments(outlineConfig, id).catch(() => [])
		)
	);
	const docs = perCollection.flat().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

	return json({ docs });
};
