<script lang="ts">
	import { onMount } from 'svelte';
	import { ServiceFactory } from '../../services/ServiceFactory';
	import type { Person } from '../../services/local/PeopleService';
	import type { IPeopleService } from '../../services/interfaces/IPeopleService';
	import type { ITaskService } from '../../services/interfaces/ITaskService';
	import AddPersonModal from './AddPersonModal.svelte';
	import type { TaskWithContext } from '../../types/task';
	import { PersonStandingIcon } from '@lucide/svelte';

	let peopleService: IPeopleService;
	let taskService: ITaskService;
	let people = $state<Person[]>([]);
	let showAddModal = $state(false);
	let searchQuery = $state('');
	let personTasks = $state<Map<string, TaskWithContext[]>>(new Map());

	onMount(() => {
		peopleService = ServiceFactory.createPeopleService();
		taskService = ServiceFactory.createTaskService();
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

	async function loadPeople() {
		const result = peopleService.getAllPeople();
		people = result instanceof Promise ? await result : result;
		loadPersonTasks();
	}

	async function loadPersonTasks() {
		const taskMap = new Map<string, TaskWithContext[]>();
		for (const person of people) {
			const result = taskService.getPersonTasks(person.id);
			const tasks = result instanceof Promise ? await result : result;
			taskMap.set(person.id, tasks);
		}
		personTasks = taskMap;
	}

	async function handleAddPerson(personData: { name: string; email?: string }) {
		try {
			const result = peopleService.addPerson(personData);
			if (result instanceof Promise) await result;
			await loadPeople();
			showAddModal = false;
		} catch (error) {
			console.error('Failed to add person:', error);
			alert('Failed to add person. In Firebase mode, users must be authenticated first.');
		}
	}

	async function handleDeletePerson(id: string) {
		if (confirm('Are you sure you want to delete this person?')) {
			try {
				const result = peopleService.deletePerson(id);
				const success = result instanceof Promise ? await result : result;
				if (success) {
					await loadPeople();
				} else {
					alert(
						'Cannot delete authenticated users. They must be deactivated through user management.'
					);
				}
			} catch (error) {
				console.error('Failed to delete person:', error);
				alert('Failed to delete person.');
			}
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
	<div class=" border-b bg-white px-6 py-4">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="rounded-md text-4xl font-semibold">👽 People</h2>
				<!-- <p class="text-zinc-400 mt-1">Manage your research projects</p> -->
			</div>
			<!-- <button
				class="transition- flex items-center gap-2 rounded-full border border-white bg-borg-green px-4 py-2 text-white transition-all hover:cursor-pointer hover:bg-black
				"
				onclick={() => (showAddModal = true)}
			>
				<Plus class="h-4 w-4" />
				New Project
			</button> -->
		</div>
	</div>

	<!-- Search -->
	<div class="p-6">
		<input
			bind:value={searchQuery}
			type="text"
			placeholder="Search people..."
			class="w-full rounded border border-black bg-white px-3 py-2 text-black placeholder-zinc-500 focus:ring-2 focus:ring-borg-blue focus:outline-none"
		/>
	</div>

	<!-- People List -->
	<div class="flex-1 overflow-y-auto px-6 pb-6">
		{#if filteredPeople.length == 0}
			<div class="flex h-64 flex-col items-center justify-center text-center">
				<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-lg">
					<!-- <svg class="h-8 w-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
						/>
					</svg> -->
					<PersonStandingIcon class="h-8 w-8" />
				</div>
				<h3 class="mb-2 text-xl font-medium text-black">
					{searchQuery ? 'No people found' : 'No people yet'}
				</h3>
				<!-- <p class="mb-4 text-zinc-500">
					{searchQuery
						? 'Try a different search term'
						: 'Add your first collaborator to get started'}
				</p> -->
				<!-- {#if !searchQuery}
					<button
						onclick={() => (showAddModal = true)}
						class="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-500"
					>
						Add Person
					</button>
				{/if} -->
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each filteredPeople as person}
					{@const tasks = personTasks.get(person.id) || []}
					{@const activeTaskCount = tasks.filter((t) => !t.resolvedAt).length}
					<div class="box-shadow-black rounded-lg border border-zinc-800 bg-white p-4">
						<div class="mb-4 flex items-start justify-between">
							<div class="flex items-center gap-3">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-full border border-black bg-borg-green"
								>
									<span class="text-sm font-medium text-white">{getInitials(person.name)}</span>
								</div>
								<div>
									<h3 class="font-medium text-black">{person.name}</h3>
									{#if person.email}
										<p class="text-sm text-zinc-600">{person.email}</p>
									{/if}
								</div>
							</div>
							<!-- <button
								onclick={() => handleDeletePerson(person.id)}
								class="text-zinc-500 transition-colors hover:text-rose-400"
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
							</button> -->
						</div>

						<!-- Tasks Section -->
						{#if activeTaskCount > 0}
							<div class="rounded-lg border border-black bg-borg-orange p-3">
								<div class="mb-2 flex items-center justify-between">
									<span class="text-sm font-semibold text-white">ACTIVE TASKS</span>
									<span class="rounded-full border border-black bg-white px-2 py-1 text-xs"
										>{activeTaskCount}</span
									>
								</div>
								<div class="space-y-1">
									{#each tasks.filter((t) => !t.resolvedAt).slice(0, 3) as task}
										<div class="text-xs text-white">
											<span class="font-medium text-white">{task.projectTitle || 'Unknown'}</span>: {task.title}
										</div>
									{/each}
									{#if activeTaskCount > 3}
										<div class="text-xs text-white">
											+{activeTaskCount - 3} more...
										</div>
									{/if}
								</div>
							</div>
						{/if}

						<!-- <div class="text-xs text-zinc-500">
							Added {formatDate(person.createdAt.seconds)}
						</div> -->
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

{#if showAddModal}
	<AddPersonModal onAdd={handleAddPerson} onClose={() => (showAddModal = false)} />
{/if}
