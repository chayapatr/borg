// Parses an Outline comment into a Borg task request.
// Grammar: a comment must start with "TASK:" (case-insensitive) to be
// treated as a task request. A trailing "@Name" mention (v1 supports only
// a trailing mention, not one anywhere in the text) sets the assignee name
// to resolve; everything else after "TASK:" and before the mention is the
// task title.

export type ParsedTaskComment =
	| { kind: 'not-a-task' }
	| { kind: 'parse-error' }
	| { kind: 'task'; title: string; mentionedName: string | null };

const TASK_PREFIX = /^task:\s*/i;
const TRAILING_MENTION = /@([A-Za-z][\w'-]*(?:\s+[A-Za-z][\w'-]*)*)$/;

export function parseTaskComment(rawText: string): ParsedTaskComment {
	const trimmed = rawText.trim();
	if (!TASK_PREFIX.test(trimmed)) {
		return { kind: 'not-a-task' };
	}

	const withoutPrefix = trimmed.replace(TASK_PREFIX, '').trim();

	const mentionMatch = withoutPrefix.match(TRAILING_MENTION);
	const mentionedName = mentionMatch ? mentionMatch[1].trim() : null;
	const title = (mentionMatch ? withoutPrefix.slice(0, mentionMatch.index).trim() : withoutPrefix).trim();

	if (!title) {
		return { kind: 'parse-error' };
	}

	return { kind: 'task', title, mentionedName };
}

// Outline comment payloads may deliver rich/ProseMirror content instead of
// plain text. Flatten to plain text defensively — if `data` is already a
// string, use it as-is; if it's a ProseMirror-style doc, walk it and join
// text nodes.
export function extractPlainText(commentData: unknown): string {
	if (typeof commentData === 'string') return commentData;
	if (!commentData || typeof commentData !== 'object') return '';

	const parts: string[] = [];
	function walk(node: any) {
		if (!node) return;
		if (typeof node.text === 'string') parts.push(node.text);
		if (Array.isArray(node.content)) node.content.forEach(walk);
	}
	walk(commentData);
	return parts.join(' ');
}
