<script lang="ts">
	import { onMount } from 'svelte';
	import { PeopleService, type Person } from '../../services/PeopleService';
	import AddPersonModal from './AddPersonModal.svelte';

	let peopleService: PeopleService;
	let people = $state<Person[]>([]);
	let showAddModal = $state(false);
	let searchQuery = $state('');

	onMount(() => {
		peopleService = new PeopleService();
		loadPeople();

		// Listen for visibility changes to refresh data
		function handleVisibilityChange() {
			if (!document.hidden) {
				loadPeople();
			}
		}

		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	});

	function loadPeople() {
		people = peopleService.getAllPeople();
	}

	function handleAddPerson(personData: { name: string; email?: string }) {
		peopleService.addPerson(personData);
		loadPeople();
		showAddModal = false;
	}

	function handleDeletePerson(id: string) {
		if (confirm('Are you sure you want to delete this person?')) {
			peopleService.deletePerson(id);
			loadPeople();
		}
	}

	let filteredPeople = $derived.by(() => {
		if (!searchQuery.trim()) return people;

		const lowercaseQuery = searchQuery.toLowerCase();
		return people.filter(
			(person) =>
				person.name.toLowerCase().includes(lowercaseQuery) ||
				person.email?.toLowerCase().includes(lowercaseQuery)
		);
	});

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString();
	}

	function getInitials(name: string) {
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}
</script>

<div class="flex flex-1 flex-col">
	<!-- Header -->
	<div class="border-b border-zinc-800 p-6">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-2xl font-semibold text-zinc-100">People</h2>
				<p class="mt-1 text-zinc-400">Manage collaborators and team members</p>
			</div>
			<button
				onclick={() => (showAddModal = true)}
				class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-500"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 4v16m8-8H4"
					/>
				</svg>
				Add Person
			</button>
		</div>
	</div>

	<!-- Search -->
	<div class="p-6">
		<input
			bind:value={searchQuery}
			type="text"
			placeholder="Search people..."
			class="w-full max-w-md rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
		/>
	</div>

	<!-- People List -->
	<div class="flex-1 overflow-y-auto px-6 pb-6">
		{#if filteredPeople.length === 0}
			<div class="flex h-64 flex-col items-center justify-center text-center">
				<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-zinc-800">
					<svg class="h-8 w-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
						/>
					</svg>
				</div>
				<h3 class="mb-2 text-lg font-medium text-zinc-300">
					{searchQuery ? 'No people found' : 'No people yet'}
				</h3>
				<p class="mb-4 text-zinc-500">
					{searchQuery
						? 'Try a different search term'
						: 'Add your first collaborator to get started'}
				</p>
				{#if !searchQuery}
					<button
						onclick={() => (showAddModal = true)}
						class="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-500"
					>
						Add Person
					</button>
				{/if}
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each filteredPeople as person}
					<div
						class="rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-700"
					>
						<div class="mb-3 flex items-start justify-between">
							<div class="flex items-center gap-3">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600"
								>
									<span class="text-sm font-medium text-white">{getInitials(person.name)}</span>
								</div>
								<div>
									<h3 class="font-medium text-zinc-100">{person.name}</h3>
									{#if person.email}
										<p class="text-sm text-zinc-400">{person.email}</p>
									{/if}
								</div>
							</div>
							<button
								onclick={() => handleDeletePerson(person.id)}
								class="text-zinc-500 transition-colors hover:text-red-400"
								aria-label="Delete person"
							>
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
									/>
								</svg>
							</button>
						</div>

						<div class="text-xs text-zinc-500">
							Added {formatDate(person.createdAt)}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

{#if showAddModal}
	<AddPersonModal onAdd={handleAddPerson} onClose={() => (showAddModal = false)} />
{/if}
