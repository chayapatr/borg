<script lang="ts">
	import type { Person } from '../../services/local/PeopleService';
	import type { IPeopleService } from '../../services/interfaces/IPeopleService';
	import type { ITaskService } from '../../services/interfaces/ITaskService';
	import AddPersonModal from './AddPersonModal.svelte';
	import type { TaskWithContext } from '../../types/task';
	import { PersonStandingIcon, UserCheck, UserX, Shield, Users } from '@lucide/svelte';
	import { ServiceFactory } from '../../services/ServiceFactory';
	import type { IUserService } from '../../services/interfaces';

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
	let approvalUserTypes = $state<Map<string, 'member' | 'collaborator'>>(new Map());
	let userService: IUserService;

	// Lazy load data when tab becomes active
	$effect(() => {
		if (activeTab === 'people' && !dataLoaded) {
			userService = ServiceFactory.createUserService();
			loadPeople();
			loadUnapprovedUsers();
		}
	});

	async function loadPeople(force = false) {
		if (dataLoaded && !force) return; // Prevent duplicate loading unless forced

		// Use UserService to get proper user data with userType
		const users = await userService.getApprovedUsers();
		people = users.map((user) => ({
			id: user.id,
			name: user.name,
			email: user.email,
			photoUrl: user.photoUrl,
			userType: user.userType
		}));

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

	// Load unapproved users
	async function loadUnapprovedUsers() {
		if (loadingUnapproved) return;
		loadingUnapproved = true;

		try {
			const users = await userService.getUnapprovedUsers();
			unapprovedUsers = users;

			// Initialize approval user types to default 'member'
			const newApprovalTypes = new Map();
			users.forEach((user) => {
				newApprovalTypes.set(user.id, 'member');
			});
			approvalUserTypes = newApprovalTypes;
		} catch (error) {
			console.error('Failed to load unapproved users:', error);
		} finally {
			loadingUnapproved = false;
		}
	}

	// Approve a user
	async function approveUser(userId: string) {
		try {
			const userType = approvalUserTypes.get(userId) || 'member';
			const success = await userService.approveUser(userId, userType);

			if (success) {
				// Remove from unapproved list and refresh people list
				unapprovedUsers = unapprovedUsers.filter((user) => user.id !== userId);
				approvalUserTypes.delete(userId);
				approvalUserTypes = new Map(approvalUserTypes);
				await loadPeople(true);
			} else {
				alert('Failed to approve user');
			}
		} catch (error) {
			console.error('Failed to approve user:', error);
			alert('Failed to approve user');
		}
	}

	function handleUserTypeChange(userId: string, userType: 'member' | 'collaborator') {
		approvalUserTypes.set(userId, userType);
		approvalUserTypes = new Map(approvalUserTypes);
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

	// Separate members and collaborators
	let members = $derived(
		filteredPeople.filter((person) => !person.userType || person.userType === 'member')
	);
	let collaborators = $derived(
		filteredPeople.filter((person) => person.userType === 'collaborator')
	);

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
	<div class=" flex h-16 flex-col justify-center border-b bg-white px-6">
		<div class="flex items-center justify-between">
			<div>
				<div class="flex items-center gap-3">
					<Users class="h-8 w-8" />
					<h2 class="rounded-md text-3xl font-semibold">People</h2>
				</div>
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
			<!-- Members Section -->
			{#if members.length > 0}
				<div class="mb-8">
					<h3 class="mb-4 flex items-center gap-2 text-lg font-semibold text-black">
						<Users class="h-5 w-5 text-borg-violet" />
						Members ({members.length})
					</h3>
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
						{#each members as person}
							{@const activeTaskCount = personTasks.get(person.id) || 0}
							<div class="box-shadow-black rounded-lg border border-zinc-800 bg-white p-4">
								<div class="mb-4 flex items-start justify-between">
									<div class="flex items-center gap-3">
										<div
											class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-black bg-borg-green"
										>
											{#if person.photoUrl}
												<img
													src={person.photoUrl}
													alt={person.name}
													class="h-full w-full object-cover"
												/>
											{:else}
												<span class="text-sm font-medium text-white"
													>{getInitials(person.name)}</span
												>
											{/if}
										</div>
										<div>
											<h3 class="font-medium text-black">{person.name}</h3>
											{#if person.email}
												<p class="text-sm text-zinc-600">{person.email}</p>
											{/if}
										</div>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Collaborators Section -->
			{#if collaborators.length > 0}
				<div class="mb-8">
					<h3 class="mb-4 flex items-center gap-2 text-lg font-semibold text-black">
						<UserCheck class="h-5 w-5 text-borg-orange" />
						Collaborators ({collaborators.length})
					</h3>
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
						{#each collaborators as person}
							{@const activeTaskCount = personTasks.get(person.id) || 0}
							<div class="box-shadow-black rounded-lg border border-black bg-white p-4">
								<div class="mb-4 flex items-start justify-between">
									<div class="flex items-center gap-3">
										<div
											class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-black bg-white"
										>
											{#if person.photoUrl}
												<img
													src={person.photoUrl}
													alt={person.name}
													class="h-full w-full object-cover"
												/>
											{:else}
												<span class="text-sm font-medium text-zinc-800"
													>{getInitials(person.name)}</span
												>
											{/if}
										</div>
										<div>
											<h3 class="font-medium text-black">{person.name}</h3>
											{#if person.email}
												<p class="text-sm text-zinc-700">{person.email}</p>
											{/if}
										</div>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/if}

		<!-- Allow People Section -->
		<div class="mt-8 border-t border-zinc-300 pt-6">
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
				<div class="flex h-32 flex-col items-center justify-center text-center">
					<UserCheck class="mb-4 h-8 w-8" />
					<h3 class="mb-2 text-lg font-medium text-black">No pending user approvals</h3>
					<p class="text-sm text-zinc-500">All users have been approved</p>
				</div>
			{:else}
				<div class="space-y-3">
					{#each unapprovedUsers as user}
						<div
							class="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 p-4"
						>
							<div class="flex items-center gap-3">
								<div
									class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-orange-200"
								>
									{#if user.photoUrl}
										<img
											src={user.photoUrl}
											alt={user.name || user.email}
											class="h-full w-full object-cover"
										/>
									{:else}
										<span class="text-sm font-medium text-orange-800"
											>{getInitials(user.name || user.email || 'U')}</span
										>
									{/if}
								</div>
								<div>
									<h4 class="font-medium text-black">{user.name || 'Unnamed User'}</h4>
									<p class="text-sm text-gray-600">{user.email}</p>
									{#if user.createdAt}
										<p class="text-xs text-gray-500">Requested {formatDate(user.createdAt)}</p>
									{/if}
								</div>
							</div>
							<div class="flex items-center gap-3">
								<select
									value={approvalUserTypes.get(user.id) || 'member'}
									onchange={(e) => handleUserTypeChange(user.id, e.currentTarget.value)}
									class="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
								>
									<option value="member">Member</option>
									<option value="collaborator">Collaborator</option>
								</select>
								<button
									onclick={() => approveUser(user.id)}
									class="flex items-center gap-1 rounded-md border border-green-600 bg-green-600 px-3 py-1 text-sm text-white transition-colors hover:bg-green-700"
								>
									<UserCheck class="h-3 w-3" />
									Approve
								</button>
							</div>
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
