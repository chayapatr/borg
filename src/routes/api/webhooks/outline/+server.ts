import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { getDb, fsGet, fsSet, fsUpdate, fsQuery } from '$lib/server/firestoreAdmin';
import { verifyOutlineSignature } from '$lib/server/outlineWebhookAuth';
import { parseTaskComment, extractPlainText } from '$lib/server/outlineCommentParser';
import { createComment, getDocument } from '$lib/server/outlineApi';

// Ack immediately (200) for everything except a bad signature, so Outline
// doesn't retry events we're intentionally ignoring (wrong event type,
// non-TASK comments, duplicates).
const ACK = json({ ok: true });

export const POST: RequestHandler = async ({ request }) => {
	const rawBody = await request.text();

	const webhookSecret = env.OUTLINE_WEBHOOK_SECRET;
	const apiUrl = env.OUTLINE_API_URL;
	const apiToken = env.OUTLINE_API_TOKEN;
	const serviceAccountJson = env.FIREBASE_SERVICE_ACCOUNT_JSON;
	if (!webhookSecret || !apiUrl || !apiToken || !serviceAccountJson) {
		console.error('[outline webhook] missing required server env config');
		return new Response('Not configured', { status: 500 });
	}

	const signatureHeader = request.headers.get('outline-signature');
	const validSignature = await verifyOutlineSignature(signatureHeader, rawBody, webhookSecret);
	if (!validSignature) {
		console.warn('[outline webhook] rejected: invalid signature');
		return new Response('Invalid signature', { status: 401 });
	}

	const outlineConfig = { apiUrl, apiToken };
	const db = getDb(serviceAccountJson);

	let body: any;
	try {
		body = JSON.parse(rawBody);
	} catch {
		console.warn('[outline webhook] rejected: invalid JSON body');
		return new Response('Invalid JSON', { status: 400 });
	}

	const eventType: string | undefined = body.event;
	const eventId: string | undefined = body.id;

	if (!eventType?.startsWith('comments.create') || !eventId) {
		// Not an event we care about — ack without processing.
		return ACK;
	}

	// Dedup: short-circuit if we've already processed this delivery.
	const existing = await fsGet(db, 'outlineWebhookEvents', eventId);
	if (existing) {
		console.log(`[outline webhook] duplicate delivery, skipping: ${eventId}`);
		return ACK;
	}
	await fsSet(db, 'outlineWebhookEvents', eventId, {
		receivedAt: new Date().toISOString(),
		eventType,
		outcome: 'processing'
	});

	const model = body.payload?.model ?? {};
	const commentId: string | undefined = model.id;
	const documentId: string | undefined = model.documentId;
	const parentCommentId: string | undefined = model.parentCommentId;
	const commentText = extractPlainText(model.data ?? model.text);

	console.log('[outline webhook] received comment', {
		eventId,
		commentId,
		documentId,
		text: commentText
	});

	if (!documentId || !commentText) {
		console.warn('[outline webhook] missing documentId or comment text, skipping', { eventId });
		await fsUpdate(db, 'outlineWebhookEvents', eventId, { outcome: 'skipped_malformed_payload' });
		return ACK;
	}

	const parsed = parseTaskComment(commentText);

	if (parsed.kind === 'not-a-task') {
		console.log(`[outline webhook] skipped: not a TASK comment (${eventId})`);
		await fsUpdate(db, 'outlineWebhookEvents', eventId, { outcome: 'skipped_not_task' });
		return ACK;
	}

	if (parsed.kind === 'parse-error') {
		await postReply(
			outlineConfig,
			documentId,
			parentCommentId ?? commentId,
			'⚠️ Could not create a task from this comment — expected format "TASK: <title> [@Name]".'
		);
		await fsUpdate(db, 'outlineWebhookEvents', eventId, { outcome: 'parse_error' });
		return ACK;
	}

	// parsed.kind === 'task'
	let assigneeId = '';
	let assigneeName: string | null = null;
	let mentionUnmatched = false;

	if (parsed.mentionedName) {
		const approvedUsers = await fsQuery(db, 'users', 'isApproved', 'EQUAL', true);
		const needle = parsed.mentionedName.toLowerCase();
		const match = approvedUsers.find((u) => {
			const name = (u.data.name as string | undefined)?.toLowerCase();
			return name?.includes(needle);
		});
		if (match) {
			assigneeId = match.id;
			assigneeName = (match.data.name as string) || null;
		} else {
			mentionUnmatched = true;
		}
	}

	// Prefer the doc title carried in the payload; fall back to one API call.
	let outlineDocTitle: string = model.document?.title;
	if (!outlineDocTitle) {
		try {
			const doc = await getDocument(outlineConfig, documentId);
			outlineDocTitle = doc.title;
		} catch {
			outlineDocTitle = 'Untitled Doc';
		}
	}

	const taskId = crypto.randomUUID();
	const nowIso = new Date().toISOString();
	await fsSet(db, 'tasks', taskId, {
		id: taskId,
		title: parsed.title,
		assignee: assigneeId,
		dueDate: '',
		notes: '',
		createdAt: nowIso,
		status: 'active',
		sourceType: 'outline',
		projectId: '',
		projectSlug: '',
		projectTitle: '',
		nodeId: documentId,
		nodeTitle: outlineDocTitle,
		nodeType: 'outline',
		outlineDocId: documentId,
		outlineDocTitle,
		createdBy: 'outline-webhook',
		isOverdue: false
	});

	let outcome: string;
	let replyText: string;
	if (assigneeId) {
		outcome = 'task_created';
		replyText = `✅ Task created and assigned to ${assigneeName}.`;
	} else if (mentionUnmatched) {
		outcome = 'unassigned_unmatched';
		replyText = `⚠️ Task created but unassigned — no person matched "@${parsed.mentionedName}".`;
	} else {
		outcome = 'unassigned';
		replyText = '✅ Task created (unassigned).';
	}

	await postReply(outlineConfig, documentId, parentCommentId ?? commentId, replyText);
	await fsUpdate(db, 'outlineWebhookEvents', eventId, { outcome, taskId });

	return ACK;
};

async function postReply(
	outlineConfig: { apiUrl: string; apiToken: string },
	documentId: string,
	parentCommentId: string | undefined,
	text: string
) {
	try {
		await createComment(outlineConfig, { documentId, text, parentCommentId });
	} catch (err) {
		// Don't fail the webhook over a failed confirmation reply — the task
		// (or parse-error outcome) already happened independent of this.
		console.error('[outline webhook] failed to post reply comment', err);
	}
}
