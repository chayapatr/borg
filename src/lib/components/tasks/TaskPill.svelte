<script lang="ts">
	import type { PersonTaskCount } from '../../types/task';
	import { ServiceFactory } from '../../services/ServiceFactory';
	import type { IPeopleService } from '../../services/interfaces';

	interface Props {
		personTaskCount: PersonTaskCount;
		onclick?: () => void;
	}

	let { personTaskCount, onclick }: Props = $props();

	const peopleService: IPeopleService = ServiceFactory.createPeopleService();
	let person = $state<any>(null);

	// Load person data
	$effect(() => {
		(async () => {
			const result = peopleService.getPerson(personTaskCount.personId);
			person = result instanceof Promise ? await result : result;
		})();
	});
</script>

<button
	class="inline-flex items-center gap-1 rounded-full border border-black bg-borg-orange px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-borg-orange/90"
	onclick={(event) => {
		event.stopPropagation();
		onclick?.();
	}}
>
	<span>{person?.name || 'Unknown'}</span>
	<span class="text-rose-300">({personTaskCount.count})</span>
</button>
