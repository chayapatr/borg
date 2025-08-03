<script lang="ts">
	import type { PersonTaskCount } from '../../types/task';
	import { PeopleService } from '../../services/local/PeopleService';

	interface Props {
		personTaskCount: PersonTaskCount;
		onclick?: () => void;
	}

	let { personTaskCount, onclick }: Props = $props();

	const peopleService = new PeopleService();
	const person = $derived(peopleService.getPerson(personTaskCount.personId));
</script>

<button
	class="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-1 text-xs font-medium text-rose-400 hover:bg-rose-500/30 transition-colors"
	onclick={(event) => {
		event.stopPropagation();
		onclick?.();
	}}
>
	<span>{person?.name || 'Unknown'}</span>
	<span class="text-rose-300">({personTaskCount.count})</span>
</button>