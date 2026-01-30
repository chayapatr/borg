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
		Folder
	} from '@lucide/svelte';
	import { ServiceFactory } from '$lib/services/ServiceFactory';

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

	let editing = $state(false);
	let editContent = $state(content);
	let textareaRef: HTMLTextAreaElement | null = $state(null);

	// Command menu state
	let showCommandMenu = $state(false);
	let commandFilter = $state('');
	let selectedCommandIndex = $state(0);
	let commandTriggerPosition = $state(0); // Position where / was typed
	let isInlineCommand = $state(false); // Whether command is mid-text

	// Configure marked
	marked.setOptions({
		breaks: true,
		gfm: true
	});

	// Custom renderer to handle inline page/project links and tasks
	function renderContent(text: string): string {
		// First, protect our wiki links from markdown processing by replacing them temporarily
		const linkPlaceholders = new Map<string, string>();
		let placeholderIndex = 0;

		// Replace [[task:...]] with placeholders
		text = text.replace(/\[\[task:([^\]]+)\]\]/g, (match, taskId) => {
			const placeholder = `WIKITASKLINK${placeholderIndex}ENDLINK`;
			linkPlaceholders.set(placeholder, taskId);
			placeholderIndex++;
			return placeholder;
		});

		// Replace [[page:...]] with placeholders using a format that won't be interpreted as markdown
		text = text.replace(/\[\[page:([^\]]+)\]\]/g, (match, pageId) => {
			const placeholder = `WIKIPAGELINK${placeholderIndex}ENDLINK`;
			linkPlaceholders.set(placeholder, pageId);
			placeholderIndex++;
			return placeholder;
		});

		// Replace [[project:...]] with placeholders
		text = text.replace(/\[\[project:([^\]]+)\]\]/g, (match, slug) => {
			const placeholder = `WIKIPROJECTLINK${placeholderIndex}ENDLINK`;
			linkPlaceholders.set(placeholder, slug);
			placeholderIndex++;
			return placeholder;
		});

		// Process markdown
		let html = marked(text) as string;

		// Now replace placeholders with actual HTML
		linkPlaceholders.forEach((value, placeholder) => {
			if (placeholder.startsWith('WIKITASKLINK')) {
				const taskId = value;
				html = html.replace(
					placeholder,
					`<span class="wiki-inline-task" data-task-id="${taskId}"><input type="checkbox" class="task-checkbox" data-task-id="${taskId}" /><span class="task-title" data-task-id="${taskId}">Loading...</span><span class="task-assignee" data-task-id="${taskId}"></span></span>`
				);
			} else if (placeholder.startsWith('WIKIPAGELINK')) {
				const pageId = value;
				html = html.replace(
					placeholder,
					`<span class="wiki-inline-link wiki-page-link" data-page-id="${pageId}"><svg class="inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14,2 14,8 20,8"></polyline></svg><span class="link-text" data-page-id="${pageId}">Loading...</span></span>`
				);
			} else if (placeholder.startsWith('WIKIPROJECTLINK')) {
				const slug = value;
				html = html.replace(
					placeholder,
					`<span class="wiki-inline-link wiki-project-link" data-project-slug="${slug}"><svg class="inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg><span class="link-text" data-project-slug="${slug}">Loading...</span></span>`
				);
			}
		});

		return html;
	}

	let renderedContent = $derived(renderContent(content));

	let filteredCommands = $derived.by(() => {
		const filtered = commands.filter(
			(cmd) =>
				cmd.label.toLowerCase().includes(commandFilter.toLowerCase()) ||
				cmd.description.toLowerCase().includes(commandFilter.toLowerCase())
		);
		// If in inline mode, show ALL commands (removed the filter for testing)
		// User can use page/project inline, or other formatting commands at start of line
		return filtered;
	});

	function startEditing() {
		editing = true;
		editContent = content;
		// Focus textarea after render
		requestAnimationFrame(() => {
			if (textareaRef) {
				textareaRef.focus();
				// Move cursor to end
				textareaRef.selectionStart = textareaRef.value.length;
				textareaRef.selectionEnd = textareaRef.value.length;
				adjustTextareaHeight();
			}
		});
		onFocus?.();
	}

	function finishEditing() {
		if (showCommandMenu) {
			// Don't finish editing if command menu is open
			return;
		}
		editing = false;
		if (editContent !== content) {
			onUpdate(editContent);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (showCommandMenu) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				selectedCommandIndex = (selectedCommandIndex + 1) % filteredCommands.length;
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				selectedCommandIndex =
					(selectedCommandIndex - 1 + filteredCommands.length) % filteredCommands.length;
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
			finishEditing();
			onEnter();
		} else if (e.key === 'Backspace' && editContent === '') {
			e.preventDefault();
			onDelete();
		} else if (e.key === 'Escape') {
			editContent = content;
			editing = false;
		}
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		editContent = target.value;
		adjustTextareaHeight();

		// Check for command trigger at cursor position
		const cursorPos = target.selectionStart;
		const textBeforeCursor = editContent.slice(0, cursorPos);

		// Find the last '/' before cursor that's not part of a URL or escaped
		const slashMatch = textBeforeCursor.match(/(?:^|\s)\/([a-zA-Z]*)$/);

		if (slashMatch) {
			// Found a slash trigger
			const slashPos = cursorPos - slashMatch[0].length + slashMatch[0].indexOf('/');
			const charBeforeSlash = editContent[slashPos - 1];
			const isAtStart = slashPos === 0 || charBeforeSlash === undefined || /\s/.test(charBeforeSlash);

			showCommandMenu = true;
			commandFilter = slashMatch[1];
			commandTriggerPosition = slashPos;
			// Consider it inline if there's any content before the slash (even if whitespace-separated)
			isInlineCommand = slashPos > 0;
			selectedCommandIndex = 0;
		} else {
			showCommandMenu = false;
			commandFilter = '';
			isInlineCommand = false;
		}
	}

	function selectCommand(cmd: CommandItem) {
		if (!textareaRef) return;

		const cursorPos = textareaRef.selectionStart;
		const commandStartPos = commandTriggerPosition;
		const commandEndPos = cursorPos;

		closeCommandMenu();

		// Handle inline link actions (page/project)
		if (cmd.action === 'page') {
			// Capture current content and position before sidebar opens
			const currentContent = editContent;

			onLinkPage?.((pageId: string) => {
				// Insert [[page:pageId]] at cursor position using captured values
				const before = currentContent.slice(0, commandStartPos);
				const after = currentContent.slice(commandEndPos);
				const inlineLink = `[[page:${pageId}]]`;
				const newContent = before + inlineLink + after;

				// Update content
				editContent = newContent;
				onUpdate(newContent);

				// Re-enter editing mode and restore focus
				requestAnimationFrame(() => {
					editing = true;
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

		if (cmd.action === 'project') {
			// Capture current content and position before sidebar opens
			const currentContent = editContent;

			onLinkProject?.((projectSlug: string) => {
				// Insert [[project:projectSlug]] at cursor position using captured values
				const before = currentContent.slice(0, commandStartPos);
				const after = currentContent.slice(commandEndPos);
				const inlineLink = `[[project:${projectSlug}]]`;
				const newContent = before + inlineLink + after;

				// Update content
				editContent = newContent;
				onUpdate(newContent);

				// Re-enter editing mode and restore focus
				requestAnimationFrame(() => {
					editing = true;
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

		// Handle task action (now inline)
		if (cmd.action === 'task') {
			// Capture current content and position before sidebar opens
			const currentContent = editContent;

			onCreateTask?.((taskId: string) => {
				// Insert [[task:taskId]] at cursor position using captured values
				const before = currentContent.slice(0, commandStartPos);
				const after = currentContent.slice(commandEndPos);
				const inlineLink = `[[task:${taskId}]]`;
				const newContent = before + inlineLink + after;

				// Update content
				editContent = newContent;
				onUpdate(newContent);

				// Re-enter editing mode and restore focus
				requestAnimationFrame(() => {
					editing = true;
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

		// Handle formatting commands
		if (isInlineCommand) {
			// Don't apply block-level formatting in inline mode
			return;
		}

		// Replace the command trigger with the prefix
		const before = editContent.slice(0, commandStartPos);
		const after = editContent.slice(commandEndPos);
		editContent = before + cmd.prefix + after;

		requestAnimationFrame(() => {
			if (textareaRef) {
				textareaRef.focus();
				// For code blocks, put cursor before the closing backticks
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
		startEditing();
	}

	// Handle clicks on inline links and tasks in preview mode
	function handlePreviewClick(e: MouseEvent) {
		const target = e.target as HTMLElement;

		// Check for task checkbox click (input element itself)
		if (target.classList.contains('task-checkbox')) {
			e.preventDefault();
			e.stopPropagation();
			const taskId = target.getAttribute('data-task-id');
			if (taskId) {
				(window as any).__toggleTask?.(taskId);
			}
			return true;
		}

		// Check for task title click
		const taskElement = target.closest('.wiki-inline-task');
		if (taskElement && !target.closest('.task-checkbox')) {
			e.preventDefault();
			e.stopPropagation();
			const taskId = taskElement.getAttribute('data-task-id');
			if (taskId) {
				(window as any).__editTask?.(taskId);
			}
			return true;
		}

		// Check for page/project link click
		const linkElement = target.closest('.wiki-inline-link');
		if (linkElement) {
			e.preventDefault();
			e.stopPropagation();

			const pageId = linkElement.getAttribute('data-page-id');
			const projectSlug = linkElement.getAttribute('data-project-slug');

			if (pageId) {
				// Navigate to page
				(window as any).__navigateToPage?.(pageId);
			} else if (projectSlug) {
				// Navigate to project
				(window as any).__navigateToProject?.(projectSlug);
			}
			return true;
		}
		return false;
	}

	// Populate link titles and task info after rendering
	onMount(() => {
		const wikiService = ServiceFactory.createWikiService();
		const projectsService = ServiceFactory.createProjectsService();
		const taskService = ServiceFactory.createTaskService();
		const peopleService = ServiceFactory.createPeopleService();

		const interval = setInterval(async () => {
			// Find all inline tasks and populate info
			const taskElements = document.querySelectorAll('.wiki-inline-task[data-task-id]');
			for (const taskEl of Array.from(taskElements)) {
				const taskId = taskEl.getAttribute('data-task-id');
				const titleEl = taskEl.querySelector('.task-title[data-task-id]');
				const assigneeEl = taskEl.querySelector('.task-assignee[data-task-id]');
				const checkboxEl = taskEl.querySelector('.task-checkbox[data-task-id]') as HTMLInputElement;

				if (taskId) {
					try {
						// Get the task - need to find which wiki/project it belongs to
						// For now, use window global to access parent's getTask function
						const task = (window as any).__getTask?.(taskId);
						if (task) {
							// Always update checkbox state (not just on first load)
							if (checkboxEl) {
								checkboxEl.checked = task.status === 'resolved';
							}

							// Only update title and assignee on first load
							if (titleEl && titleEl.textContent === 'Loading...') {
								titleEl.textContent = task.title || 'Untitled task';

								// Load assignee name if exists
								if (task.assignee && assigneeEl) {
									const result = peopleService.getPerson(task.assignee);
									const person = result instanceof Promise ? await result : result;
									if (person?.name) {
										const firstName = person.name.split(' ')[0];
										assigneeEl.textContent = `(${firstName})`;
									}
								}
							}
						} else if (titleEl && titleEl.textContent === 'Loading...') {
							titleEl.textContent = 'Unknown task';
						}
					} catch {
						if (titleEl && titleEl.textContent === 'Loading...') {
							titleEl.textContent = 'Unknown task';
						}
					}
				}
			}

			// Find all page links and populate titles
			const pageLinks = document.querySelectorAll('.wiki-page-link .link-text[data-page-id]');
			for (const linkText of Array.from(pageLinks)) {
				const pageId = linkText.getAttribute('data-page-id');
				if (pageId && linkText.textContent === 'Loading...') {
					try {
						const result = wikiService.getEntry(pageId);
						const page = result instanceof Promise ? await result : result;
						if (page) {
							linkText.textContent = page.title || 'Untitled';
						} else {
							linkText.textContent = 'Unknown Page';
						}
					} catch {
						linkText.textContent = 'Unknown Page';
					}
				}
			}

			// Find all project links and populate titles
			const projectLinks = document.querySelectorAll('.wiki-project-link .link-text[data-project-slug]');
			for (const linkText of Array.from(projectLinks)) {
				const projectSlug = linkText.getAttribute('data-project-slug');
				if (projectSlug && linkText.textContent === 'Loading...') {
					try {
						// Get all projects and find by slug
						const result = projectsService.getAllProjects();
						const projects = result instanceof Promise ? await result : result;
						const project = projects.find((p) => p.slug === projectSlug);
						if (project) {
							linkText.textContent = project.title;
						} else {
							linkText.textContent = 'Unknown Project';
						}
					} catch {
						linkText.textContent = 'Unknown Project';
					}
				}
			}
		}, 100);

		return () => clearInterval(interval);
	});
</script>

<div class="wiki-block group relative">
	{#if editing}
		<div class="relative">
			<textarea
				bind:this={textareaRef}
				value={editContent}
				oninput={handleInput}
				onblur={finishEditing}
				onkeydown={handleKeydown}
				placeholder="Type '/' for commands..."
				class="w-full resize-none bg-transparent p-2 text-base leading-relaxed text-black outline-none"
				style="max-width: 60ch;"
				rows="1"
			></textarea>

			{#if showCommandMenu}
				<div
					class="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-lg border border-black bg-white shadow-lg"
				>
					<div class="max-h-64 overflow-y-auto">
						{#each filteredCommands as cmd, index}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors {index ===
								selectedCommandIndex
									? 'bg-borg-beige'
									: 'hover:bg-borg-beige/50'}"
								onmousedown={() => selectCommand(cmd)}
								onmouseenter={() => (selectedCommandIndex = index)}
							>
								<div
									class="flex h-8 w-8 items-center justify-center rounded border border-black/20 bg-white"
								>
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
				// Only start editing if we didn't click a link
				if (!handled) {
					startEditing();
				}
			}}
			class="wiki-content min-h-[1.75rem] cursor-text rounded p-2 transition-colors hover:bg-borg-beige/30"
		>
			{#if content}
				{@html renderedContent}
			{:else}
				<p class="text-zinc-400 italic">Click to edit...</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Scoped markdown preview styling for blocks */
	.wiki-block :global(.wiki-content) {
		font-size: 1rem;
		line-height: 1.6;
		color: #000;
		max-width: 60ch;
	}

	.wiki-block :global(.wiki-content > *:first-child) {
		margin-top: 0;
	}

	.wiki-block :global(.wiki-content > *:last-child) {
		margin-bottom: 0;
	}

	.wiki-block :global(.wiki-content h1) {
		font-size: 1.75rem;
		font-weight: 700;
		margin-top: 0;
		margin-bottom: 0.25rem;
		color: #000;
	}

	.wiki-block :global(.wiki-content h2) {
		font-size: 1.375rem;
		font-weight: 600;
		margin-top: 0;
		margin-bottom: 0.25rem;
		color: #000;
	}

	.wiki-block :global(.wiki-content h3) {
		font-size: 1.125rem;
		font-weight: 600;
		margin-top: 0;
		margin-bottom: 0.25rem;
		color: #000;
	}

	.wiki-block :global(.wiki-content p) {
		margin-top: 0;
		margin-bottom: 0;
	}

	.wiki-block :global(.wiki-content ul),
	.wiki-block :global(.wiki-content ol) {
		margin-top: 0;
		margin-bottom: 0;
		padding-left: 1.5rem;
	}

	.wiki-block :global(.wiki-content li) {
		margin-bottom: 0.25rem;
	}

	.wiki-block :global(.wiki-content ul) {
		list-style-type: disc;
	}

	.wiki-block :global(.wiki-content ol) {
		list-style-type: decimal;
	}

	.wiki-block :global(.wiki-content code) {
		background-color: #d7d3d0;
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-size: 0.875rem;
		font-family: 'Google Sans Code', 'Roboto Mono', 'Courier', monospace;
		color: #000;
	}

	.wiki-block :global(.wiki-content pre) {
		background-color: #1a1a1a;
		color: #f3f3f1;
		padding: 1rem;
		border-radius: 0.5rem;
		overflow-x: auto;
		margin-top: 0;
		margin-bottom: 0;
		border: 1px solid #000;
	}

	.wiki-block :global(.wiki-content pre code) {
		background-color: transparent;
		padding: 0;
		color: #f3f3f1;
	}

	.wiki-block :global(.wiki-content blockquote) {
		border-left: 4px solid #000;
		padding-left: 1rem;
		margin-left: 0;
		margin-right: 0;
		font-style: italic;
		color: #444;
	}

	.wiki-block :global(.wiki-content a) {
		color: #4d17f5;
		text-decoration: underline;
	}

	.wiki-block :global(.wiki-content a:hover) {
		color: #8220fa;
	}

	.wiki-block :global(.wiki-content strong) {
		font-weight: 700;
	}

	.wiki-block :global(.wiki-content hr) {
		border: 0;
		border-top: 1px solid #a1a1a1;
		margin: 0.5rem 0;
	}

	.wiki-block :global(.wiki-content table) {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: 0;
	}

	.wiki-block :global(.wiki-content th),
	.wiki-block :global(.wiki-content td) {
		border: 1px solid #000;
		padding: 0.5rem 0.75rem;
		text-align: left;
	}

	.wiki-block :global(.wiki-content th) {
		background-color: #edede9;
		font-weight: 600;
	}

	.wiki-block :global(.wiki-content img) {
		max-width: 100%;
		height: auto;
		border-radius: 0.5rem;
		border: 1px solid #000;
	}

	/* Inline tasks */
	.wiki-block :global(.wiki-inline-task) {
		display: inline-flex !important;
		align-items: center;
		gap: 0.375rem;
		padding: 0.125rem 0;
		cursor: pointer;
	}

	.wiki-block :global(.wiki-inline-task .task-checkbox) {
		cursor: pointer;
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
	}

	.wiki-block :global(.wiki-inline-task .task-title) {
		font-weight: 500;
		color: #000;
	}

	.wiki-block :global(.wiki-inline-task .task-assignee) {
		font-size: 0.875rem;
		color: #71717a;
		font-weight: 400;
	}

	.wiki-block :global(.wiki-inline-task:hover .task-title) {
		text-decoration: underline;
	}

	/* Completed task styling */
	.wiki-block :global(.wiki-inline-task .task-checkbox:checked ~ .task-title) {
		text-decoration: line-through;
		color: #a1a1aa;
	}

	.wiki-block :global(.wiki-inline-task .task-checkbox:checked ~ .task-assignee) {
		color: #d4d4d8;
	}

	/* Inline wiki links */
	.wiki-block :global(.wiki-inline-link) {
		display: inline-flex !important;
		align-items: center;
		gap: 0.25rem;
		font-weight: 600;
		text-decoration: underline;
		text-decoration-color: rgba(0, 0, 0, 0.3);
		text-underline-offset: 2px;
		cursor: pointer !important;
		transition: all 0.15s ease;
		pointer-events: auto !important;
	}

	.wiki-block :global(.wiki-inline-link:hover) {
		text-decoration-color: rgba(0, 0, 0, 1);
	}

	.wiki-block :global(.wiki-inline-link .inline-icon) {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
		pointer-events: none;
	}

	.wiki-block :global(.wiki-page-link) {
		color: #000;
	}

	.wiki-block :global(.wiki-project-link) {
		color: #000;
	}

	.wiki-block :global(.wiki-inline-link .link-text) {
		pointer-events: none;
	}
</style>
