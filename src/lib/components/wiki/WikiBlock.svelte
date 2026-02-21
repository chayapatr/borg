<script lang="ts">
	import { onMount } from 'svelte';
	import { marked } from 'marked';
	import {
		Heading1,
		Heading2,
		Heading3,
		List,
		ListOrdered,
		Quote,
		Code,
		Minus,
		Type,
		CheckSquare,
		FileText,
		Folder,
		ChevronLeft
	} from '@lucide/svelte';
	import { ServiceFactory } from '$lib/services/ServiceFactory';
	import type { WikiEntry } from '$lib/types/wiki';
	import type { Project } from '$lib/types/project';

	interface Props {
		content: string;
		onUpdate: (content: string) => void;
		onEnter: () => void;
		onDelete: () => void;
		onFocus?: () => void;
		onCreateTask?: (callback: (taskId: string) => void) => void;
		onLinkPage?: (callback: (pageId: string) => void) => void;
		onLinkProject?: (callback: (projectSlug: string) => void) => void;
	}

	interface CommandItem {
		label: string;
		description: string;
		icon: typeof Type;
		prefix: string;
		action?: string;
		inlineOnly?: boolean;
	}

	const commands: CommandItem[] = [
		{ label: 'Text', description: 'Plain text paragraph', icon: Type, prefix: '' },
		{ label: 'Heading 1', description: 'Large heading', icon: Heading1, prefix: '# ' },
		{ label: 'Heading 2', description: 'Medium heading', icon: Heading2, prefix: '## ' },
		{ label: 'Heading 3', description: 'Small heading', icon: Heading3, prefix: '### ' },
		{ label: 'Bullet List', description: 'Unordered list item', icon: List, prefix: '- ' },
		{ label: 'Numbered List', description: 'Ordered list item', icon: ListOrdered, prefix: '1. ' },
		{ label: 'Quote', description: 'Blockquote', icon: Quote, prefix: '> ' },
		{ label: 'Code', description: 'Code block', icon: Code, prefix: '```\n' },
		{ label: 'Divider', description: 'Horizontal rule', icon: Minus, prefix: '---' },
		{ label: 'Task', description: 'Create a task', icon: CheckSquare, prefix: '', action: 'task', inlineOnly: true },
		{ label: 'Page', description: 'Link to a wiki page', icon: FileText, prefix: '', action: 'page', inlineOnly: true },
		{ label: 'Project', description: 'Link to a project', icon: Folder, prefix: '', action: 'project', inlineOnly: true }
	];

	let { content, onUpdate, onEnter, onDelete, onFocus, onCreateTask, onLinkPage, onLinkProject }: Props = $props();

	let focused = $state(false);
	let editContent = $state(content);
	let textareaRef: HTMLTextAreaElement | null = $state(null);

	// Command menu state
	let showCommandMenu = $state(false);
	let commandFilter = $state('');
	let selectedCommandIndex = $state(0);
	let commandTriggerPosition = $state(0);
	let commandEndPosition = $state(0);
	let isInlineCommand = $state(false);

	// Inline search state
	type InlineSearchMode = null | 'page' | 'project';
	let inlineSearchMode = $state<InlineSearchMode>(null);
	let inlineSearchQuery = $state('');
	let inlineSearchItems = $state<{ id: string; title: string; sub?: string }[]>([]);
	let inlineSearchLoading = $state(false);
	let inlineSearchIndex = $state(0);
	let inlineCallback = $state<((value: string) => void) | null>(null);
	let capturedContent = $state('');
	let capturedStartPos = $state(0);
	let capturedEndPos = $state(0);

	// Configure marked — no font size changes, same line-height
	marked.setOptions({ breaks: true, gfm: true });

	// Render markdown but keep all font sizes the same as body text
	function renderContent(text: string): string {
		if (!text) return '';
		// Protect wiki links
		const linkPlaceholders = new Map<string, string>();
		let placeholderIndex = 0;

		text = text.replace(/\[\[task:([^\]]+)\]\]/g, (_, taskId) => {
			const ph = `WIKITASKLINK${placeholderIndex}ENDLINK`;
			linkPlaceholders.set(ph, taskId);
			placeholderIndex++;
			return ph;
		});
		text = text.replace(/\[\[page:([^\]]+)\]\]/g, (_, pageId) => {
			const ph = `WIKIPAGELINK${placeholderIndex}ENDLINK`;
			linkPlaceholders.set(ph, pageId);
			placeholderIndex++;
			return ph;
		});
		text = text.replace(/\[\[project:([^\]]+)\]\]/g, (_, slug) => {
			const ph = `WIKIPROJECTLINK${placeholderIndex}ENDLINK`;
			linkPlaceholders.set(ph, slug);
			placeholderIndex++;
			return ph;
		});

		let html = marked(text) as string;

		linkPlaceholders.forEach((value, ph) => {
			if (ph.startsWith('WIKITASKLINK')) {
				html = html.replace(ph,
					`<span class="wiki-inline-task" data-task-id="${value}"><input type="checkbox" class="task-checkbox" data-task-id="${value}" /><span class="task-title" data-task-id="${value}">Loading...</span><span class="task-assignee" data-task-id="${value}"></span></span>`
				);
			} else if (ph.startsWith('WIKIPAGELINK')) {
				html = html.replace(ph,
					`<span class="wiki-inline-link wiki-page-link" data-page-id="${value}"><span class="link-text" data-page-id="${value}">Loading...</span></span>`
				);
			} else if (ph.startsWith('WIKIPROJECTLINK')) {
				html = html.replace(ph,
					`<span class="wiki-inline-link wiki-project-link" data-project-slug="${value}"><span class="link-text" data-project-slug="${value}">Loading...</span></span>`
				);
			}
		});

		return html;
	}

	let renderedContent = $derived(renderContent(content));

	// Detect heading level for live font size in textarea
	let headingLevel = $derived.by(() => {
		const t = editContent;
		if (t.startsWith('### ') || t === '###') return 3;
		if (t.startsWith('## ') || t === '##') return 2;
		if (t.startsWith('# ') || t === '#') return 1;
		return 0;
	});

	const headingTextareaStyle: Record<number, string> = {
		1: 'font-size: 1.375rem; line-height: 1.3; font-weight: 700;',
		2: 'font-size: 1.125rem; line-height: 1.4; font-weight: 600;',
		3: 'font-size: 1rem; line-height: 1.5; font-weight: 600;'
	};

	let textareaStyle = $derived(headingLevel > 0 ? headingTextareaStyle[headingLevel] : '');

	// Re-measure height when heading level changes (line-height changes)
	$effect(() => {
		headingLevel; // track
		requestAnimationFrame(() => adjustTextareaHeight());
	});

	let filteredCommands = $derived.by(() => {
		return commands.filter(
			(cmd) =>
				cmd.label.toLowerCase().includes(commandFilter.toLowerCase()) ||
				cmd.description.toLowerCase().includes(commandFilter.toLowerCase())
		);
	});

	function handleFocus() {
		focused = true;
		editContent = content;
		requestAnimationFrame(() => adjustTextareaHeight());
		onFocus?.();
	}

	function handleBlur() {
		if (showCommandMenu || inlineSearchMode) return;
		focused = false;
		if (editContent !== content) {
			onUpdate(editContent);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (inlineSearchMode) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				inlineSearchIndex = (inlineSearchIndex + 1) % Math.max(1, inlineSearchItems.length);
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				inlineSearchIndex = (inlineSearchIndex - 1 + Math.max(1, inlineSearchItems.length)) % Math.max(1, inlineSearchItems.length);
			} else if (e.key === 'Enter') {
				e.preventDefault();
				if (inlineSearchItems[inlineSearchIndex]) selectInlineItem(inlineSearchItems[inlineSearchIndex]);
			} else if (e.key === 'Escape' || (e.key === 'Backspace' && inlineSearchQuery === '')) {
				e.preventDefault();
				closeInlineSearch();
			}
			return;
		}

		if (showCommandMenu) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				selectedCommandIndex = (selectedCommandIndex + 1) % filteredCommands.length;
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				selectedCommandIndex = (selectedCommandIndex - 1 + filteredCommands.length) % filteredCommands.length;
			} else if (e.key === 'Enter') {
				e.preventDefault();
				selectCommand(filteredCommands[selectedCommandIndex]);
			} else if (e.key === 'Escape') {
				e.preventDefault();
				closeCommandMenu();
			}
			return;
		}

		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			onUpdate(editContent);
			onEnter();
		} else if (e.key === 'Backspace' && editContent === '') {
			e.preventDefault();
			onDelete();
		} else if (e.key === 'Escape') {
			editContent = content;
			textareaRef?.blur();
		}
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		editContent = target.value;
		adjustTextareaHeight();

		if (inlineSearchMode) {
			const cursorPos = target.selectionStart;
			inlineSearchQuery = editContent.slice(capturedStartPos, cursorPos);
			inlineSearchIndex = 0;
			filterInlineSearch();
			return;
		}

		onUpdate(editContent);

		const cursorPos = target.selectionStart;
		const textBeforeCursor = editContent.slice(0, cursorPos);
		const slashMatch = textBeforeCursor.match(/(?:^|\s)\/([a-zA-Z]*)$/);

		if (slashMatch) {
			const slashPos = cursorPos - slashMatch[0].length + slashMatch[0].indexOf('/');
			showCommandMenu = true;
			commandFilter = slashMatch[1];
			commandTriggerPosition = slashPos;
			commandEndPosition = cursorPos;
			isInlineCommand = slashPos > 0;
			selectedCommandIndex = 0;
		} else {
			showCommandMenu = false;
			commandFilter = '';
			isInlineCommand = false;
		}
	}

	function handlePreviewClick(e: MouseEvent) {
		const target = e.target as HTMLElement;

		if (target.classList.contains('task-checkbox')) {
			e.preventDefault();
			e.stopPropagation();
			const taskId = target.getAttribute('data-task-id');
			if (taskId) (window as any).__toggleTask?.(taskId);
			return true;
		}

		const taskElement = target.closest('.wiki-inline-task');
		if (taskElement && !target.closest('.task-checkbox')) {
			e.preventDefault();
			e.stopPropagation();
			const taskId = taskElement.getAttribute('data-task-id');
			if (taskId) (window as any).__editTask?.(taskId);
			return true;
		}

		const linkElement = target.closest('.wiki-inline-link');
		if (linkElement) {
			e.preventDefault();
			e.stopPropagation();
			const pageId = linkElement.getAttribute('data-page-id');
			const projectSlug = linkElement.getAttribute('data-project-slug');
			if (pageId) (window as any).__navigateToPage?.(pageId);
			else if (projectSlug) (window as any).__navigateToProject?.(projectSlug);
			return true;
		}
		return false;
	}

	function selectCommand(cmd: CommandItem) {
		if (!textareaRef) return;

		const cursorPos = textareaRef.selectionStart;
		const commandStartPos = commandTriggerPosition;
		const commandEndPos = cursorPos;

		closeCommandMenu();

		if (cmd.action === 'page') {
			const before = editContent.slice(0, commandStartPos);
			const after = editContent.slice(commandEndPos);
			capturedContent = before + after;
			capturedStartPos = commandStartPos;
			capturedEndPos = commandStartPos;
			editContent = capturedContent;
			inlineSearchQuery = '';
			inlineSearchIndex = 0;
			inlineSearchMode = 'page';
			loadInlinePages();
			requestAnimationFrame(() => {
				if (textareaRef) {
					textareaRef.focus();
					textareaRef.selectionStart = commandStartPos;
					textareaRef.selectionEnd = commandStartPos;
					adjustTextareaHeight();
				}
			});
			return;
		}

		if (cmd.action === 'project') {
			const before = editContent.slice(0, commandStartPos);
			const after = editContent.slice(commandEndPos);
			capturedContent = before + after;
			capturedStartPos = commandStartPos;
			capturedEndPos = commandStartPos;
			editContent = capturedContent;
			inlineSearchQuery = '';
			inlineSearchIndex = 0;
			inlineSearchMode = 'project';
			loadInlineProjects();
			requestAnimationFrame(() => {
				if (textareaRef) {
					textareaRef.focus();
					textareaRef.selectionStart = commandStartPos;
					textareaRef.selectionEnd = commandStartPos;
					adjustTextareaHeight();
				}
			});
			return;
		}

		if (cmd.action === 'task') {
			const currentContent = editContent;
			onCreateTask?.((taskId: string) => {
				const before = currentContent.slice(0, commandStartPos);
				const after = currentContent.slice(commandEndPos);
				const inlineLink = `[[task:${taskId}]]`;
				const newContent = before + inlineLink + after;
				editContent = newContent;
				onUpdate(newContent);
				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						if (textareaRef) {
							textareaRef.focus();
							const newCursorPos = commandStartPos + inlineLink.length;
							textareaRef.selectionStart = newCursorPos;
							textareaRef.selectionEnd = newCursorPos;
							adjustTextareaHeight();
						}
					});
				});
			});
			return;
		}

		if (isInlineCommand) return;

		const before = editContent.slice(0, commandStartPos);
		const after = editContent.slice(commandEndPos);
		editContent = before + cmd.prefix + after;

		requestAnimationFrame(() => {
			if (textareaRef) {
				textareaRef.focus();
				if (cmd.prefix === '```\n') {
					editContent = before + '```\n\n```' + after;
					const newPos = commandStartPos + 4;
					textareaRef.selectionStart = newPos;
					textareaRef.selectionEnd = newPos;
				} else {
					const newPos = commandStartPos + cmd.prefix.length;
					textareaRef.selectionStart = newPos;
					textareaRef.selectionEnd = newPos;
				}
				adjustTextareaHeight();
			}
		});
	}

	async function loadInlinePages() {
		inlineSearchLoading = true;
		try {
			const wikiService = ServiceFactory.createWikiService();
			const result = wikiService.getAllEntries();
			const pages: WikiEntry[] = result instanceof Promise ? await result : result;
			inlineSearchItems = pages.map((p) => ({ id: p.id, title: p.title || 'Untitled' }));
		} finally {
			inlineSearchLoading = false;
		}
	}

	async function loadInlineProjects() {
		inlineSearchLoading = true;
		try {
			const projectsService = ServiceFactory.createProjectsService();
			const result = projectsService.getAllProjects();
			const projects: Project[] = result instanceof Promise ? await result : result;
			inlineSearchItems = projects.map((p) => ({ id: p.slug, title: p.title || 'Untitled', sub: p.slug }));
		} finally {
			inlineSearchLoading = false;
		}
	}

	let filteredInlineItems = $derived(
		inlineSearchItems.filter((item) =>
			item.title.toLowerCase().includes(inlineSearchQuery.toLowerCase()) ||
			(item.sub ?? '').toLowerCase().includes(inlineSearchQuery.toLowerCase())
		)
	);

	function filterInlineSearch() {
		inlineSearchIndex = Math.min(inlineSearchIndex, Math.max(0, filteredInlineItems.length - 1));
	}

	function selectInlineItem(item: { id: string; title: string; sub?: string }) {
		const linkType = inlineSearchMode;
		const before = capturedContent.slice(0, capturedStartPos);
		const after = capturedContent.slice(capturedStartPos);
		closeInlineSearch();

		const inlineLink = linkType === 'page' ? `[[page:${item.id}]]` : `[[project:${item.id}]]`;
		const newContent = before + inlineLink + after;

		editContent = newContent;
		onUpdate(newContent);

		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				if (textareaRef) {
					textareaRef.focus();
					const newCursorPos = capturedStartPos + inlineLink.length;
					textareaRef.selectionStart = newCursorPos;
					textareaRef.selectionEnd = newCursorPos;
					adjustTextareaHeight();
				}
			});
		});
	}

	function closeInlineSearch() {
		if (inlineSearchQuery && textareaRef) {
			editContent = capturedContent;
			requestAnimationFrame(() => {
				if (textareaRef) {
					textareaRef.selectionStart = capturedStartPos;
					textareaRef.selectionEnd = capturedStartPos;
					adjustTextareaHeight();
				}
			});
		}
		inlineSearchMode = null;
		inlineSearchQuery = '';
		inlineSearchItems = [];
		inlineSearchIndex = 0;
		inlineCallback = null;
	}

	function closeCommandMenu() {
		showCommandMenu = false;
		commandFilter = '';
		selectedCommandIndex = 0;
	}

	function adjustTextareaHeight() {
		if (textareaRef) {
			textareaRef.style.height = 'auto';
			textareaRef.style.height = textareaRef.scrollHeight + 'px';
		}
	}

	export function focus() {
		requestAnimationFrame(() => {
			if (textareaRef) {
				textareaRef.focus();
				textareaRef.selectionStart = textareaRef.value.length;
				textareaRef.selectionEnd = textareaRef.value.length;
				adjustTextareaHeight();
			}
		});
		onFocus?.();
	}

	// Populate inline link titles after render
	onMount(() => {
		const wikiService = ServiceFactory.createWikiService();
		const projectsService = ServiceFactory.createProjectsService();
		const peopleService = ServiceFactory.createPeopleService();

		const interval = setInterval(async () => {
			const taskElements = document.querySelectorAll('.wiki-inline-task[data-task-id]');
			for (const taskEl of Array.from(taskElements)) {
				const taskId = taskEl.getAttribute('data-task-id');
				const titleEl = taskEl.querySelector('.task-title[data-task-id]');
				const assigneeEl = taskEl.querySelector('.task-assignee[data-task-id]');
				const checkboxEl = taskEl.querySelector('.task-checkbox[data-task-id]') as HTMLInputElement;
				if (taskId) {
					try {
						const task = (window as any).__getTask?.(taskId);
						if (task) {
							if (checkboxEl) checkboxEl.checked = task.status === 'resolved';
							if (titleEl && titleEl.textContent === 'Loading...') {
								titleEl.textContent = task.title || 'Untitled task';
								if (task.assignee && assigneeEl) {
									const result = peopleService.getPerson(task.assignee);
									const person = result instanceof Promise ? await result : result;
									if (person?.name) assigneeEl.textContent = `(${person.name.split(' ')[0]})`;
								}
							}
						} else if (titleEl && titleEl.textContent === 'Loading...') {
							titleEl.textContent = 'Unknown task';
						}
					} catch {
						if (titleEl && titleEl.textContent === 'Loading...') titleEl.textContent = 'Unknown task';
					}
				}
			}

			const pageLinks = document.querySelectorAll('.wiki-page-link .link-text[data-page-id]');
			for (const linkText of Array.from(pageLinks)) {
				const pageId = linkText.getAttribute('data-page-id');
				if (pageId && linkText.textContent === 'Loading...') {
					try {
						const result = wikiService.getEntry(pageId);
						const page = result instanceof Promise ? await result : result;
						linkText.textContent = page?.title || 'Unknown Page';
					} catch {
						linkText.textContent = 'Unknown Page';
					}
				}
			}

			const projectLinks = document.querySelectorAll('.wiki-project-link .link-text[data-project-slug]');
			for (const linkText of Array.from(projectLinks)) {
				const projectSlug = linkText.getAttribute('data-project-slug');
				if (projectSlug && linkText.textContent === 'Loading...') {
					try {
						const result = projectsService.getAllProjects();
						const projects = result instanceof Promise ? await result : result;
						const project = projects.find((p) => p.slug === projectSlug);
						linkText.textContent = project?.title || 'Unknown Project';
					} catch {
						linkText.textContent = 'Unknown Project';
					}
				}
			}
		}, 100);

		return () => clearInterval(interval);
	});
</script>

<div class="wiki-block relative">
	{#if focused}
		<div class="relative">
			<textarea
				bind:this={textareaRef}
				value={editContent}
				oninput={handleInput}
				onfocus={handleFocus}
				onblur={handleBlur}
				onkeydown={handleKeydown}
				placeholder="Type '/' for commands..."
				class="w-full resize-none bg-transparent py-0.5 text-sm leading-relaxed text-black outline-none placeholder:text-zinc-300"
				style={textareaStyle}
				rows="1"
			></textarea>

			{#if inlineSearchMode}
				<div class="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg">
					<div class="flex items-center gap-2 border-b border-zinc-100 px-3 py-2">
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<button
							class="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600"
							onmousedown={() => closeInlineSearch()}
						>
							<ChevronLeft class="h-3.5 w-3.5" />
						</button>
						<span class="text-xs font-medium text-zinc-500">
							{inlineSearchMode === 'page' ? 'Link page' : 'Link project'}
						</span>
						<span class="ml-auto text-xs text-zinc-400">{inlineSearchQuery || 'type to filter...'}</span>
					</div>
					<div class="max-h-56 overflow-y-auto">
						{#if inlineSearchLoading}
							<div class="flex items-center justify-center py-6">
								<div class="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600"></div>
							</div>
						{:else if filteredInlineItems.length === 0}
							<div class="px-3 py-4 text-center text-sm text-zinc-400">
								{inlineSearchItems.length === 0 ? 'None available' : 'No results'}
							</div>
						{:else}
							{#each filteredInlineItems as item, index}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									class="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors {index === inlineSearchIndex ? 'bg-borg-beige' : 'hover:bg-borg-beige/50'}"
									onmousedown={() => selectInlineItem(item)}
									onmouseenter={() => (inlineSearchIndex = index)}
								>
									<div class="flex h-7 w-7 items-center justify-center rounded border border-zinc-200 bg-white">
										{#if inlineSearchMode === 'page'}
											<FileText class="h-3.5 w-3.5" />
										{:else}
											<Folder class="h-3.5 w-3.5" />
										{/if}
									</div>
									<div class="min-w-0 flex-1">
										<div class="truncate text-sm font-medium">{item.title}</div>
										{#if item.sub}
											<div class="truncate text-xs text-zinc-400">{item.sub}</div>
										{/if}
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			{:else if showCommandMenu}
				<div class="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg">
					<div class="max-h-64 overflow-y-auto">
						{#each filteredCommands as cmd, index}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors {index === selectedCommandIndex ? 'bg-borg-beige' : 'hover:bg-borg-beige/50'}"
								onmousedown={() => selectCommand(cmd)}
								onmouseenter={() => (selectedCommandIndex = index)}
							>
								<div class="flex h-8 w-8 items-center justify-center rounded border border-zinc-200 bg-white">
									<cmd.icon class="h-4 w-4" />
								</div>
								<div>
									<div class="text-sm font-medium">{cmd.label}</div>
									<div class="text-xs text-zinc-500">{cmd.description}</div>
								</div>
							</div>
						{/each}
						{#if filteredCommands.length === 0}
							<div class="px-3 py-4 text-center text-sm text-zinc-500">No commands found</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			onclick={(e) => {
				const handled = handlePreviewClick(e);
				if (!handled) {
					focused = true;
					requestAnimationFrame(() => {
						textareaRef?.focus();
						adjustTextareaHeight();
					});
				}
			}}
			class="wiki-content min-h-[1.5rem] cursor-text py-0.5"
		>
			{#if content}
				{@html renderedContent}
			{:else}
				<span class="text-zinc-300">Type something...</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* All text same size as textarea — no layout shift */
	.wiki-block :global(.wiki-content) {
		font-size: 0.875rem;
		line-height: 1.625; /* matches leading-relaxed */
		color: #000;
	}

	.wiki-block :global(.wiki-content > *:first-child) { margin-top: 0; }
	.wiki-block :global(.wiki-content > *:last-child) { margin-bottom: 0; }

	/* Headings: different sizes like Obsidian */
	.wiki-block :global(.wiki-content h1),
	.wiki-block :global(.wiki-content h2),
	.wiki-block :global(.wiki-content h3) {
		margin-top: 0;
		margin-bottom: 0;
		color: #000;
	}
	.wiki-block :global(.wiki-content h1) { font-size: 1.375rem; line-height: 1.3; font-weight: 700; }
	.wiki-block :global(.wiki-content h2) { font-size: 1.125rem; line-height: 1.4; font-weight: 600; }
	.wiki-block :global(.wiki-content h3) { font-size: 1rem; line-height: 1.5; font-weight: 600; color: #3f3f46; }

	.wiki-block :global(.wiki-content p) { margin-top: 0; margin-bottom: 0; }

	/* Lists: no indent shift — use same padding as textarea would show */
	.wiki-block :global(.wiki-content ul),
	.wiki-block :global(.wiki-content ol) {
		margin-top: 0;
		margin-bottom: 0;
		padding-left: 1.25rem;
	}
	.wiki-block :global(.wiki-content li) { margin-bottom: 0; }
	.wiki-block :global(.wiki-content ul) { list-style-type: disc; }
	.wiki-block :global(.wiki-content ol) { list-style-type: decimal; }

	.wiki-block :global(.wiki-content code) {
		background-color: #edede9;
		padding: 0.1rem 0.3rem;
		border-radius: 0.2rem;
		font-size: 0.875rem;
		font-family: 'Roboto Mono', 'Courier', monospace;
		color: #000;
	}

	.wiki-block :global(.wiki-content pre) {
		background-color: #1a1a1a;
		color: #f3f3f1;
		padding: 0.75rem 1rem;
		border-radius: 0.375rem;
		overflow-x: auto;
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.625;
	}
	.wiki-block :global(.wiki-content pre code) {
		background-color: transparent;
		padding: 0;
		color: #f3f3f1;
	}

	.wiki-block :global(.wiki-content blockquote) {
		border-left: 3px solid #d4d4d8;
		padding-left: 0.75rem;
		margin: 0;
		color: #71717a;
		font-style: italic;
	}

	.wiki-block :global(.wiki-content a) {
		color: #4d17f5;
		text-decoration: underline;
	}
	.wiki-block :global(.wiki-content strong) { font-weight: 700; }
	.wiki-block :global(.wiki-content em) { font-style: italic; }

	.wiki-block :global(.wiki-content hr) {
		border: 0;
		border-top: 1px solid #d4d4d8;
		margin: 0.25rem 0;
	}

	/* Inline tasks */
	.wiki-block :global(.wiki-inline-task) {
		display: inline-flex !important;
		align-items: center;
		gap: 0.375rem;
		cursor: pointer;
	}
	.wiki-block :global(.wiki-inline-task .task-checkbox) {
		cursor: pointer;
		width: 0.875rem;
		height: 0.875rem;
		flex-shrink: 0;
	}
	.wiki-block :global(.wiki-inline-task .task-title) { font-weight: 500; }
	.wiki-block :global(.wiki-inline-task .task-assignee) { color: #71717a; font-size: 0.875rem; }
	.wiki-block :global(.wiki-inline-task:hover .task-title) { text-decoration: underline; }
	.wiki-block :global(.wiki-inline-task .task-checkbox:checked ~ .task-title) {
		text-decoration: line-through;
		color: #a1a1aa;
	}

	/* Inline wiki links */
	.wiki-block :global(.wiki-inline-link) {
		display: inline;
		font-weight: 600;
		text-decoration: underline;
		text-decoration-color: rgba(0,0,0,0.3);
		text-underline-offset: 2px;
		cursor: pointer !important;
		pointer-events: auto !important;
	}
	.wiki-block :global(.wiki-inline-link:hover) { text-decoration-color: rgba(0,0,0,1); }
	.wiki-block :global(.wiki-inline-link .link-text) { pointer-events: none; }
</style>
