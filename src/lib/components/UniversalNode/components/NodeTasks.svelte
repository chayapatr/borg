<script lang="ts">
	import { ListTodo } from '@lucide/svelte';
	import type { Task } from '../../../types/task';

	let { tasks, borderColor, onTaskClick, onAddTaskClick } = $props<{
		tasks: Task[];
		borderColor: string;
		onTaskClick: () => void;
		onAddTaskClick: () => void;
	}>();

	let hasTasks = $derived(tasks.length > 0);
</script>

{#if hasTasks}
	<!-- Tasks Section (appears below/attached to the main node) -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="relative max-w-64 min-w-48 cursor-pointer rounded-b-lg border border-t-0 bg-borg-brown p-2 transition-colors hover:bg-borg-beige"
		style="border-color: {borderColor};"
		onclick={onTaskClick}
	>
		<div class="space-y-1">
			{#each tasks.slice(0, 3) as task}
				<div class="flex items-center gap-2 text-xs text-black">
					<div class="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-black"></div>
					<span class="truncate" title={task.title}>
						{task.title.length > 30 ? task.title.substring(0, 30) + '...' : task.title}
					</span>
				</div>
			{/each}
			{#if tasks.length > 3}
				<div class="mt-2 text-xs text-black/70">
					+{tasks.length - 3} more tasks
				</div>
			{/if}
		</div>
		<!-- <button
			onclick={(event) => {
				event.stopPropagation();
				onTaskClick();
			}}
			class="absolute -right-2 -bottom-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-black bg-black text-white transition-colors hover:bg-borg-yellow hover:text-black"
		>
			<ListTodo class="h-3 w-3" />
		</button> -->
	</div>
{:else}
	<!-- Add task button (positioned relative to the parent container) -->
	<!-- <button
		onclick={(event) => {
			event.stopPropagation();
			onAddTaskClick();
		}}
		class="absolute -right-2 -bottom-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-black bg-black text-white transition-colors hover:bg-borg-orange hover:text-black"
	>
		<ListTodo class="h-3 w-3" />
	</button> -->

	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="relative max-w-64 min-w-48 cursor-pointer rounded-b-lg border border-t-0 bg-borg-brown p-2 transition-colors hover:bg-borg-beige"
		style="border-color: {borderColor};"
		onclick={(event) => {
			event.stopPropagation();
			onTaskClick();
		}}
	>
		<div class="space-y-1 text-xs">+ Add Task</div>
	</div>
{/if}
