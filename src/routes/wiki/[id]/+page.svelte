<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ServiceFactory } from '$lib/services/ServiceFactory';
	import type { IWikiService } from '$lib/services/interfaces/IWikiService';
	import type { WikiEntry } from '$lib/types/wiki';
	import { Save } from '@lucide/svelte';
	import { marked } from 'marked';

	const wikiId = $derived($page.params.id);

	let wikiService: IWikiService;
	let entry = $state<WikiEntry | null>(null);
	let loading = $state(true);
	let saving = $state(false);
	let subscriptionCleanup: (() => void) | null = null;

	// Local state for editing
	let title = $state('');
	let content = $state('');
	let hasChanges = $state(false);

	// Autosave timer
	let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

	// Configure marked
	marked.setOptions({
		breaks: true,
		gfm: true
	});

	// Render markdown to HTML
	let renderedContent = $derived(marked(content) as string);

	onMount(() => {
		wikiService = ServiceFactory.createWikiService();
		loadEntry();

		return () => {
			if (subscriptionCleanup) {
				subscriptionCleanup();
			}
			if (autosaveTimer) {
				clearTimeout(autosaveTimer);
			}
		};
	});

	async function loadEntry() {
		if (!wikiId) {
			goto('/wiki');
			return;
		}

		if ((wikiService as any).subscribeToEntry) {
			subscriptionCleanup = (wikiService as any).subscribeToEntry(
				wikiId,
				(updatedEntry: WikiEntry | null) => {
					if (updatedEntry) {
						entry = updatedEntry;
						// Only update local state if there are no pending changes
						if (!hasChanges) {
							title = updatedEntry.title;
							content = updatedEntry.content;
						}
					} else {
						// Entry doesn't exist, redirect to wiki index
						goto('/wiki');
					}
					loading = false;
				}
			);
		} else {
			const result = wikiService.getEntry(wikiId);
			entry = result instanceof Promise ? await result : result;
			if (entry) {
				title = entry.title;
				content = entry.content;
			} else {
				goto('/wiki');
			}
			loading = false;
		}
	}

	function handleTitleChange(e: Event) {
		const target = e.target as HTMLInputElement;
		title = target.value;
		hasChanges = true;
		scheduleAutosave();
	}

	function handleContentChange(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		content = target.value;
		hasChanges = true;
		scheduleAutosave();
	}

	function scheduleAutosave() {
		if (autosaveTimer) {
			clearTimeout(autosaveTimer);
		}
		autosaveTimer = setTimeout(() => {
			save();
		}, 1000);
	}

	async function save() {
		if (!hasChanges || saving || !wikiId) return;

		saving = true;
		await wikiService.updateEntry(wikiId, {
			title,
			content
		});
		hasChanges = false;
		saving = false;
	}

	async function handleSave() {
		if (autosaveTimer) {
			clearTimeout(autosaveTimer);
		}
		await save();
	}

	// Keyboard shortcuts
	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			handleSave();
		}
	}
</script>

<svelte:head>
	<title>{title || 'Wiki'} | BORG</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-screen w-full flex-col bg-borg-white">
	<!-- Header -->
	<div
		class="flex h-16 shrink-0 items-center justify-between border-b border-black bg-borg-white px-6"
	>
		<div class="flex items-center gap-4">
			<a href="/"> <img src="/BORG.svg" class="h-8" alt="BORG" /></a>
			<div class="h-6 w-px bg-black"></div>
			<span class="text-sm">
				{#if saving}
					Saving...
				{:else if hasChanges}
					Unsaved changes
				{:else}
					Saved
				{/if}
			</span>
		</div>
		<button
			onclick={handleSave}
			disabled={!hasChanges || saving}
			class="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
		>
			<Save class="h-4 w-4" />
			Save
		</button>
	</div>

	<!-- Content -->
	{#if loading}
		<div class="flex flex-1 items-center justify-center">
			<div
				class="h-8 w-8 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent"
			></div>
		</div>
	{:else}
		<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
			<!-- Title input -->
			<div class="shrink-0 border-b border-neutral-400 px-6 py-4">
				<input
					type="text"
					value={title}
					oninput={handleTitleChange}
					placeholder="Wiki Title"
					class="w-full bg-transparent text-3xl font-bold text-black placeholder-zinc-400 outline-none"
				/>
			</div>

			<!-- Editor / Preview split -->
			<div class="flex min-h-0 flex-1">
				<!-- Editor pane (left) -->
				<div class="flex w-1/2 flex-col border-r border-neutral-400">
					<div class="shrink-0 border-b border-neutral-400 bg-borg-beige px-4 py-2">
						<span class="text-sm font-semibold tracking-wide uppercase">Markdown</span>
					</div>
					<div class="min-h-0 flex-1 overflow-auto p-6">
						<textarea
							value={content}
							oninput={handleContentChange}
							placeholder="Write your content using Markdown...

# Heading 1
## Heading 2

**Bold** and *italic* text

- Bullet list
- Another item

1. Numbered list
2. Second item

[Link text](url)

`inline code`

```
code block
```"
							class="h-full w-full resize-none bg-transparent text-lg leading-relaxed text-black placeholder-zinc-400 outline-none"
						></textarea>
					</div>
				</div>

				<!-- Preview pane (right) -->
				<div class="flex w-1/2 flex-col">
					<div class="shrink-0 border-b border-neutral-400 bg-borg-beige px-4 py-2">
						<span class="text-sm font-semibold tracking-wide uppercase">Preview</span>
					</div>
					<div class="prose min-h-0 flex-1 overflow-auto p-6">
						{#if content}
							{@html renderedContent}
						{:else}
							<p class="text-zinc-400 italic">Start writing to see the preview...</p>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Markdown preview styling */
	:global(.prose) {
		font-size: 1.125rem;
		line-height: 1.75;
		color: #000;
	}

	:global(.prose h1) {
		font-size: 2.25rem;
		font-weight: 700;
		margin-top: 0;
		margin-bottom: 1rem;
		border-bottom: 1px solid #a1a1a1;
		padding-bottom: 0.5rem;
		color: #000;
	}

	:global(.prose h2) {
		font-size: 1.75rem;
		font-weight: 600;
		margin-top: 1.5rem;
		margin-bottom: 0.75rem;
		color: #000;
	}

	:global(.prose h3) {
		font-size: 1.375rem;
		font-weight: 600;
		margin-top: 1.25rem;
		margin-bottom: 0.5rem;
		color: #000;
	}

	:global(.prose p) {
		margin-top: 0;
		margin-bottom: 1rem;
	}

	:global(.prose ul),
	:global(.prose ol) {
		margin-top: 0;
		margin-bottom: 1rem;
		padding-left: 1.5rem;
	}

	:global(.prose li) {
		margin-bottom: 0.25rem;
	}

	:global(.prose ul) {
		list-style-type: disc;
	}

	:global(.prose ol) {
		list-style-type: decimal;
	}

	:global(.prose code) {
		background-color: #d7d3d0;
		padding: 0.125rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 1rem;
		font-family: 'Google Sans Code', 'Roboto Mono', 'Courier', monospace;
		color: #000;
	}

	:global(.prose pre) {
		background-color: #1a1a1a;
		color: #f3f3f1;
		padding: 1rem;
		border-radius: 0.5rem;
		overflow-x: auto;
		margin-top: 0;
		margin-bottom: 1rem;
		border: 1px solid #000;
	}

	:global(.prose pre code) {
		background-color: transparent;
		padding: 0;
		color: #f3f3f1;
	}

	:global(.prose blockquote) {
		border-left: 4px solid #000;
		padding-left: 1rem;
		margin-left: 0;
		margin-right: 0;
		font-style: italic;
		color: #444;
	}

	:global(.prose a) {
		color: #4d17f5;
		text-decoration: underline;
	}

	:global(.prose a:hover) {
		color: #8220fa;
	}

	:global(.prose strong) {
		font-weight: 700;
	}

	:global(.prose hr) {
		border: 0;
		border-top: 1px solid #a1a1a1;
		margin: 1.5rem 0;
	}

	:global(.prose table) {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: 1rem;
	}

	:global(.prose th),
	:global(.prose td) {
		border: 1px solid #000;
		padding: 0.5rem 0.75rem;
		text-align: left;
	}

	:global(.prose th) {
		background-color: #edede9;
		font-weight: 600;
	}

	:global(.prose img) {
		max-width: 100%;
		height: auto;
		border-radius: 0.5rem;
		border: 1px solid #000;
	}
</style>
