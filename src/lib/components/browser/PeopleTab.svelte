<script lang="ts">
	import type { Person } from '../../services/local/PeopleService';
	import type { IPeopleService } from '../../services/interfaces/IPeopleService';
	import type { ITaskService } from '../../services/interfaces/ITaskService';
	import AddPersonModal from './AddPersonModal.svelte';
	import type { TaskWithContext } from '../../types/task';
	import { PersonStandingIcon, UserCheck, UserX, Shield } from '@lucide/svelte';
	import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
	import { db } from '../../firebase/config';

	let { peopleService, taskService, activeTab } = $props<{
		peopleService: IPeopleService;
		taskService: ITaskService;
		activeTab: string;
	}>();

	let people = $state<Person[]>([]);
	let showAddModal = $state(false);
	let searchQuery = $state('');
	let personTasks = $state<Map<string, number>>(new Map());
	let dataLoaded = $state(false);
	let unapprovedUsers = $state<any[]>([]);
	let loadingUnapproved = $state(false);

	// Lazy load data when tab becomes active
	$effect(() => {
		if (activeTab === 'people' && !dataLoaded) {
			loadPeople();
			loadUnapprovedUsers();
		}
	});

	async function loadPeople(force = false) {
		if (dataLoaded && !force) return; // Prevent duplicate loading unless forced

		const result = peopleService.getAllPeople();
		people = result instanceof Promise ? await result : result;

		// Load task counts for each person
		// await loadAllPersonTaskCounts();
		dataLoaded = true;
	}

	// Load task counts for all people
	async function loadAllPersonTaskCounts() {
		const taskCounts = new Map<string, number>();

		for (const person of people) {
			try {
				const result = taskService.getPersonTasks(person.id);
				const tasks = result instanceof Promise ? await result : result;
				const activeTaskCount = tasks.filter((t: any) => !t.resolvedAt).length;
				taskCounts.set(person.id, activeTaskCount);
			} catch (error) {
				console.error(`Failed to load tasks for person ${person.id}:`, error);
				taskCounts.set(person.id, 0);
			}
		}

		personTasks = taskCounts;
	}

	// Load unapproved users from Firestore
	async function loadUnapprovedUsers() {
		if (loadingUnapproved) return;
		loadingUnapproved = true;

		try {
			const q = query(collection(db, 'users'), where('isApproved', '==', false));
			const snapshot = await getDocs(q);

			unapprovedUsers = snapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data()
			}));
		} catch (error) {
			console.error('Failed to load unapproved users:', error);
		} finally {
			loadingUnapproved = false;
		}
	}

	// Approve a user
	async function approveUser(userId: string) {
		try {
			await updateDoc(doc(db, 'users', userId), {
				isApproved: true,
				approvedAt: new Date().toISOString()
			});

			// Remove from unapproved list and refresh people list
			unapprovedUsers = unapprovedUsers.filter((user) => user.id !== userId);
			await loadPeople(true);
		} catch (error) {
			console.error('Failed to approve user:', error);
			alert('Failed to approve user');
		}
	}

	async function handleAddPerson(personData: { name: string; email?: string }) {
		try {
			const result = peopleService.addPerson(personData);
			if (result instanceof Promise) await result;
			await loadPeople(true); // Force reload
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
					await loadPeople(true); // Force reload
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

	function formatDate(dateString: string | { seconds: number }) {
		if (typeof dateString === 'object' && dateString.seconds) {
			return new Date(dateString.seconds * 1000).toLocaleDateString();
		}
		return new Date(dateString as string).toLocaleDateString();
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
					<PersonStandingIcon class="h-8 w-8" />
				</div>
				<h3 class="mb-2 text-xl font-medium text-black">
					{searchQuery ? 'No people found' : 'No people yet'}
				</h3>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each filteredPeople as person}
					{@const activeTaskCount = personTasks.get(person.id) || 0}
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
						</div>

						<!-- Task Count Section -->
						<!-- {#if activeTaskCount > 0}
							<div class="rounded-lg border border-black bg-borg-orange p-3">
								<div class="flex items-center justify-between">
									<span class="text-sm font-semibold text-white">ACTIVE TASKS</span>
									<span
										class="rounded-full border border-black bg-white px-2 py-1 text-xs font-medium"
										>{activeTaskCount}</span
									>
								</div>
							</div>
						{:else}
							<div class="rounded-lg border border-gray-300 bg-gray-100 p-3">
								<div class="flex items-center justify-between">
									<span class="text-sm font-medium text-gray-600">NO ACTIVE TASKS</span>
									<span class="rounded-full bg-white px-2 py-1 text-xs font-medium text-gray-500"
										>0</span
									>
								</div>
							</div>
						{/if} -->
					</div>
				{/each}
			</div>
		{/if}

		<!-- Allow People Section -->
		<div class="mt-8 border-t pt-6">
			<div class="mb-4 flex items-center gap-2">
				<Shield class="h-5 w-5 text-borg-orange" />
				<h3 class="text-xl font-semibold text-black">Allow People</h3>
			</div>

			{#if loadingUnapproved}
				<div class="flex items-center justify-center p-8">
					<div
						class="h-6 w-6 animate-spin rounded-full border-2 border-borg-orange border-t-transparent"
					></div>
					<span class="ml-2 text-sm text-gray-600">Loading pending approvals...</span>
				</div>
			{:else if unapprovedUsers.length === 0}
				<div class="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
					<UserCheck class="mx-auto h-8 w-8 text-gray-400" />
					<p class="mt-2 text-sm text-gray-600">No pending user approvals</p>
				</div>
			{:else}
				<div class="space-y-3">
					{#each unapprovedUsers as user}
						<div
							class="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 p-4"
						>
							<div class="flex items-center gap-3">
								<div class="flex h-8 w-8 items-center justify-center rounded-full bg-orange-200">
									<span class="text-sm font-medium text-orange-800"
										>{getInitials(user.name || user.email || 'U')}</span
									>
								</div>
								<div>
									<h4 class="font-medium text-black">{user.name || 'Unnamed User'}</h4>
									<p class="text-sm text-gray-600">{user.email}</p>
									{#if user.createdAt}
										<p class="text-xs text-gray-500">Requested {formatDate(user.createdAt)}</p>
									{/if}
								</div>
							</div>
							<button
								onclick={() => approveUser(user.id)}
								class="flex items-center gap-1 rounded-md border border-green-600 bg-green-600 px-3 py-1 text-sm text-white transition-colors hover:bg-green-700"
							>
								<UserCheck class="h-3 w-3" />
								Approve
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

{#if showAddModal}
	<AddPersonModal onAdd={handleAddPerson} onClose={() => (showAddModal = false)} />
{/if}
