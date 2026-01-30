<script lang="ts">
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
		CheckSquare
	} from '@lucide/svelte';

	interface Props {
		content: string;
		onUpdate: (content: string) => void;
		onEnter: () => void;
		onDelete: () => void;
		onFocus?: () => void;
		onCreateTask?: () => void;
	}

	interface CommandItem {
		label: string;
		description: string;
		icon: typeof Type;
		prefix: string;
		action?: string;
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
		{ label: 'Task', description: 'Create a task', icon: CheckSquare, prefix: '', action: 'task' }
	];

	let { content, onUpdate, onEnter, onDelete, onFocus, onCreateTask }: Props = $props();

	let editing = $state(false);
	let editContent = $state(content);
	let textareaRef: HTMLTextAreaElement | null = $state(null);

	// Command menu state
	let showCommandMenu = $state(false);
	let commandFilter = $state('');
	let selectedCommandIndex = $state(0);

	// Configure marked
	marked.setOptions({
		breaks: true,
		gfm: true
	});

	let renderedContent = $derived(marked(content) as string);

	let filteredCommands = $derived(
		commands.filter(
			(cmd) =>
				cmd.label.toLowerCase().includes(commandFilter.toLowerCase()) ||
				cmd.description.toLowerCase().includes(commandFilter.toLowerCase())
		)
	);

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

		// Check for command trigger
		if (editContent === '/') {
			showCommandMenu = true;
			commandFilter = '';
			selectedCommandIndex = 0;
		} else if (editContent.startsWith('/') && showCommandMenu) {
			commandFilter = editContent.slice(1);
			selectedCommandIndex = 0;
		} else {
			showCommandMenu = false;
		}
	}

	function selectCommand(cmd: CommandItem) {
		closeCommandMenu();

		// Handle special actions
		if (cmd.action === 'task') {
			editing = false;
			editContent = '';
			onCreateTask?.();
			return;
		}

		editContent = cmd.prefix;

		requestAnimationFrame(() => {
			if (textareaRef) {
				textareaRef.focus();
				// For code blocks, put cursor before the closing backticks
				if (cmd.prefix === '```\n') {
					editContent = '```\n\n```';
					textareaRef.selectionStart = 4;
					textareaRef.selectionEnd = 4;
				} else {
					textareaRef.selectionStart = editContent.length;
					textareaRef.selectionEnd = editContent.length;
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
			onclick={startEditing}
			class="prose min-h-[1.75rem] cursor-text rounded p-2 transition-colors hover:bg-borg-beige/30"
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
	.wiki-block :global(.prose) {
		font-size: 1rem;
		line-height: 1.6;
		color: #000;
	}

	.wiki-block :global(.prose > *:first-child) {
		margin-top: 0;
	}

	.wiki-block :global(.prose > *:last-child) {
		margin-bottom: 0;
	}

	.wiki-block :global(.prose h1) {
		font-size: 1.75rem;
		font-weight: 700;
		margin-top: 0;
		margin-bottom: 0.25rem;
		color: #000;
	}

	.wiki-block :global(.prose h2) {
		font-size: 1.375rem;
		font-weight: 600;
		margin-top: 0;
		margin-bottom: 0.25rem;
		color: #000;
	}

	.wiki-block :global(.prose h3) {
		font-size: 1.125rem;
		font-weight: 600;
		margin-top: 0;
		margin-bottom: 0.25rem;
		color: #000;
	}

	.wiki-block :global(.prose p) {
		margin-top: 0;
		margin-bottom: 0;
	}

	.wiki-block :global(.prose ul),
	.wiki-block :global(.prose ol) {
		margin-top: 0;
		margin-bottom: 0;
		padding-left: 1.5rem;
	}

	.wiki-block :global(.prose li) {
		margin-bottom: 0.25rem;
	}

	.wiki-block :global(.prose ul) {
		list-style-type: disc;
	}

	.wiki-block :global(.prose ol) {
		list-style-type: decimal;
	}

	.wiki-block :global(.prose code) {
		background-color: #d7d3d0;
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-size: 0.875rem;
		font-family: 'Google Sans Code', 'Roboto Mono', 'Courier', monospace;
		color: #000;
	}

	.wiki-block :global(.prose pre) {
		background-color: #1a1a1a;
		color: #f3f3f1;
		padding: 1rem;
		border-radius: 0.5rem;
		overflow-x: auto;
		margin-top: 0;
		margin-bottom: 0;
		border: 1px solid #000;
	}

	.wiki-block :global(.prose pre code) {
		background-color: transparent;
		padding: 0;
		color: #f3f3f1;
	}

	.wiki-block :global(.prose blockquote) {
		border-left: 4px solid #000;
		padding-left: 1rem;
		margin-left: 0;
		margin-right: 0;
		font-style: italic;
		color: #444;
	}

	.wiki-block :global(.prose a) {
		color: #4d17f5;
		text-decoration: underline;
	}

	.wiki-block :global(.prose a:hover) {
		color: #8220fa;
	}

	.wiki-block :global(.prose strong) {
		font-weight: 700;
	}

	.wiki-block :global(.prose hr) {
		border: 0;
		border-top: 1px solid #a1a1a1;
		margin: 0.5rem 0;
	}

	.wiki-block :global(.prose table) {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: 0;
	}

	.wiki-block :global(.prose th),
	.wiki-block :global(.prose td) {
		border: 1px solid #000;
		padding: 0.5rem 0.75rem;
		text-align: left;
	}

	.wiki-block :global(.prose th) {
		background-color: #edede9;
		font-weight: 600;
	}

	.wiki-block :global(.prose img) {
		max-width: 100%;
		height: auto;
		border-radius: 0.5rem;
		border: 1px solid #000;
	}
</style>
