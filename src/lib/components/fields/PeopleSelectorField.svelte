<script lang="ts">
	import { ServiceFactory } from '../../services/ServiceFactory';
	import type { TemplateField } from '../../templates';

	let {
		field,
		value = $bindable(),
		readonly = false,
		mode = 'display'
	} = $props<{
		field: TemplateField;
		value: any;
		readonly?: boolean;
		mode?: 'display' | 'edit';
	}>();

	// Services for synced data
	const peopleService = ServiceFactory.createPeopleService();

	// State for people data
	let allPeople = $state<any[]>([]);
	let peopleMap = $state<Map<string, any>>(new Map());

	// Load people data reactively
	$effect(() => {
		(async () => {
			const result = peopleService.getAllPeople();
			const people = result instanceof Promise ? await result : result;
			allPeople = people;

			// Create a map for quick lookup
			const map = new Map();
			people.forEach((person) => map.set(person.id, person));
			peopleMap = map;
		})();
	});
</script>

<div class="field-container">
	<label class="mb-1 block text-sm font-medium text-zinc-600">
		{field.label}
	</label>

	<div class="space-y-2">
		<div class="flex flex-wrap gap-1">
			{#if value && Array.isArray(value) && value.length > 0}
				{#each value as personId}
					{@const person = peopleMap.get(personId)}
					{#if person}
						<span
							class="inline-flex items-center gap-1 rounded-full bg-borg-blue px-2 py-1 text-xs text-white"
						>
							{person.name}
							{#if mode === 'edit'}
								<button
									onclick={() => {
										value = value.filter((id) => id !== personId);
									}}
									class="hover:text-red-300"
								>
									×
								</button>
							{/if}
						</span>
					{/if}
				{/each}
			{/if}

			{#if mode === 'edit'}
				{@const availablePeople = allPeople.filter((p) => !value?.includes(p.id))}
				{#if availablePeople.length > 0}
					<select
						value=""
						onchange={(e) => {
							const target = e.target as HTMLSelectElement;
							const selectedId = target.value;
							if (selectedId) {
								value = value ? [...value, selectedId] : [selectedId];
								target.value = '';
							}
						}}
						class="rounded border border-zinc-700 bg-white px-2 py-1 text-xs text-black focus:border-borg-blue focus:outline-none"
					>
						<option value="">Add person...</option>
						{#each availablePeople as person}
							<option value={person.id}>{person.name}</option>
						{/each}
					</select>
				{/if}
			{/if}
		</div>
	</div>
</div>