import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { createComment } from '$lib/server/outlineApi';

// Echoes a Borg task mutation (edited/resolved/reopened/deleted) back into
// the Outline thread that originated it. Fire-and-forget from the caller's
// side — failures here should never surface as a failed task mutation.
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return error(401, 'Unauthorized');
	}

	const { outlineDocId, commentId, message } = await request.json();
	if (!outlineDocId || !message) {
		return error(400, 'outlineDocId and message are required');
	}

	const apiUrl = env.OUTLINE_API_URL;
	const apiToken = env.OUTLINE_API_TOKEN;
	if (!apiUrl || !apiToken) {
		return error(500, 'Outline integration is not configured');
	}
	const outlineConfig = { apiUrl, apiToken };

	try {
		await createComment(outlineConfig, {
			documentId: outlineDocId,
			text: message,
			parentCommentId: commentId
		});
	} catch (err) {
		console.error('[outline task-events] failed to post echo comment', err);
		return error(502, 'Failed to notify Outline');
	}

	return json({ ok: true });
};
