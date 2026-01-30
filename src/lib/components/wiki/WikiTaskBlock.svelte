<script lang="ts">
	import { CheckCircle2, Circle, Calendar, User } from '@lucide/svelte';
	import type { Task } from '$lib/types/task';
	import { ServiceFactory } from '$lib/services/ServiceFactory';

	interface Props {
		task: Task;
		onEdit: () => void;
		onResolve: () => void;
	}

	let { task, onEdit, onResolve }: Props = $props();

	const peopleService = ServiceFactory.createPeopleService();
	let assigneeName = $state<string | null>(null);

	$effect(() => {
		if (task.assignee) {
			(async () => {
				const result = peopleService.getPerson(task.assignee);
				const person = result instanceof Promise ? await result : result;
				assigneeName = person?.name || null;
			})();
		} else {
			assigneeName = null;
		}
	});

	const isResolved = $derived(task.status === 'resolved');
	const isOverdue = $derived(
		task.dueDate && !isResolved && new Date(task.dueDate) < new Date()
	);

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="group inline-flex cursor-pointer items-start gap-3 rounded-lg border border-black bg-borg-white p-3 transition-colors hover:bg-borg-beige/30 {isResolved ? 'opacity-60' : ''}"
	onclick={onEdit}
>
	<!-- Checkbox -->
	<button
		class="mt-0.5 shrink-0 text-zinc-400 hover:text-black"
		onclick={(e) => { e.stopPropagation(); onResolve(); }}
	>
		{#if isResolved}
			<CheckCircle2 class="h-5 w-5 text-green-600" />
		{:else}
			<Circle class="h-5 w-5" />
		{/if}
	</button>

	<!-- Content -->
	<div class="min-w-0 flex-1">
		<div class="text-sm font-medium {isResolved ? 'line-through text-zinc-500' : 'text-black'}">
			{task.title || 'Untitled task'}
		</div>

		{#if task.dueDate || assigneeName}
			<div class="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
				{#if task.dueDate}
					<span class="flex items-center gap-1 {isOverdue ? 'text-red-600 font-medium' : ''}">
						<Calendar class="h-3 w-3" />
						{formatDate(task.dueDate)}
					</span>
				{/if}
				{#if assigneeName}
					<span class="flex items-center gap-1">
						<User class="h-3 w-3" />
						{assigneeName}
					</span>
				{/if}
			</div>
		{/if}
	</div>
</div>
