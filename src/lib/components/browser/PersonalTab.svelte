<script lang="ts">
	import { User, CheckSquare, Edit, Check, X } from '@lucide/svelte';
	import type { ITaskService } from '../../services/interfaces/ITaskService';
	import type { TaskWithContext } from '../../types/task';
	import { authStore } from '../../stores/authStore';
	import { doc, updateDoc, getDoc } from 'firebase/firestore';
	import { db } from '../../firebase/config';
	import TaskPill from '../tasks/TaskPill.svelte';

	let { taskService, activeTab } = $props<{
		taskService: ITaskService;
		activeTab: string;
	}>();

	let userTasks = $state<TaskWithContext[]>([]);
	let personalData = $state({
		preferredName: '',
		loading: false,
		saving: false
	});

	// Get profile image from Firebase user (read-only)
	let profileImageUrl = $state('');

	// Update profile image when auth changes
	$effect(() => {
		const user = $authStore.user;
		if (user && user.photoURL) {
			profileImageUrl = user.photoURL;
			console.log('Setting profile image URL:', user.photoURL);
		} else {
			profileImageUrl = '';
			console.log('No photoURL found in user:', user);
		}
	});
	let dataLoaded = $state(false);
	let isEditingName = $state(false);

	// Load data when tab becomes active
	$effect(() => {
		if (activeTab === 'personal' && !dataLoaded) {
			loadPersonalData();
			loadUserTasks();
		}
	});

	async function loadPersonalData() {
		personalData.loading = true;
		const currentUser = $authStore.user;

		if (!currentUser) {
			personalData.loading = false;
			return;
		}

		try {
			const userRef = doc(db, 'users', currentUser.uid);
			const userDoc = await getDoc(userRef);

			if (userDoc.exists()) {
				const userData = userDoc.data();
				personalData.preferredName = userData.preferredName || currentUser.displayName || '';
			} else {
				personalData.preferredName = currentUser.displayName || '';
			}

			// Store initial values to track changes
			initialData.preferredName = personalData.preferredName;
		} catch (error) {
			console.error('Failed to load personal data:', error);
		} finally {
			personalData.loading = false;
			dataLoaded = true;
		}
	}

	async function loadUserTasks() {
		const currentUser = $authStore.user;
		if (!currentUser) return;

		try {
			const result = taskService.getPersonTasks(currentUser.email || '');
			const tasks = result instanceof Promise ? await result : result;
			userTasks = tasks.filter((task: any) => !task.resolvedAt);
		} catch (error) {
			console.error('Failed to load user tasks:', error);
			userTasks = [];
		}
	}

	async function savePersonalData() {
		const currentUser = $authStore.user;
		if (!currentUser) return;

		personalData.saving = true;

		try {
			const userRef = doc(db, 'users', currentUser.uid);
			await updateDoc(userRef, {
				preferredName: personalData.preferredName,
				updatedAt: new Date()
			});
		} catch (error) {
			console.error('Failed to save personal data:', error);
			alert('Failed to save changes');
		} finally {
			personalData.saving = false;
		}
	}

	function handleImageError(event: Event) {
		const target = event.target as HTMLImageElement;
		if (target) {
			target.style.display = 'none';
		}
	}

	// Track initial values to avoid saving on load
	let initialData = $state({
		preferredName: ''
	});
</script>

<div class="flex flex-1 flex-col">
	<!-- Header -->
	<div class=" flex h-16 flex-col justify-center border-b bg-white px-6">
		<div class="flex items-center gap-3">
			<User class="h-8 w-8" />
			<h2 class="text-3xl font-semibold">Personal</h2>
		</div>
	</div>

	{#if personalData.loading}
		<div class="flex h-64 items-center justify-center">
			<div
				class="h-6 w-6 animate-spin rounded-full border-2 border-black border-t-transparent"
			></div>
			<span class="ml-2 text-sm text-gray-600">Loading...</span>
		</div>
	{:else}
		<div class="flex-1 overflow-y-auto p-6">
			<!-- Personal Profile Card -->
			<div class="box-shadow-black mb-6 rounded-lg border border-zinc-800 bg-white p-6">
				<div class="flex items-center gap-4">
					{#if profileImageUrl}
						<div class="h-16 w-16 overflow-hidden rounded-full border border-black">
							<img
								src={profileImageUrl}
								alt="Profile"
								class="h-full w-full object-cover"
								referrerpolicy="no-referrer"
								onerror={handleImageError}
							/>
						</div>
					{/if}
					<div class="flex-1">
						<div class="mb-1 flex items-center">
							{#if isEditingName}
								<input
									bind:value={personalData.preferredName}
									type="text"
									placeholder={initialData.preferredName || 'Your preferred name'}
									class="border-b border-gray-300 bg-transparent px-0 text-xl font-semibold text-black focus:border-blue-500 focus:outline-none"
									onfocus={(e) => e.target.select()}
								/>
								<button
									onclick={() => {
										isEditingName = false;
										savePersonalData();
									}}
									class="p-1 text-green-600 hover:text-green-700"
									title="Save"
								>
									<Check class="h-4 w-4" />
								</button>
								<button
									onclick={() => {
										isEditingName = false;
										personalData.preferredName = initialData.preferredName;
									}}
									class="p-1 text-red-600 hover:text-red-700"
									title="Cancel"
								>
									<X class="h-4 w-4" />
								</button>
							{:else}
								<h3 class="text-xl font-semibold text-black">
									{personalData.preferredName || $authStore.user?.displayName || 'No name set'}
								</h3>
								<button
									onclick={() => (isEditingName = true)}
									class="p-1 text-gray-500 hover:text-gray-700"
									title="Edit name"
								>
									<Edit class="h-4 w-4" />
								</button>
							{/if}
						</div>
						<p class="mb-3 text-sm text-zinc-600">{$authStore.user?.email}</p>
						{#if personalData.saving}
							<div class="flex items-center gap-2 text-xs text-gray-500">
								<div
									class="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-black"
								></div>
								Saving...
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- My Tasks Section -->
			<div class="box-shadow-black rounded-lg border border-zinc-800 bg-white p-6">
				<div class="mb-4 flex items-center gap-3">
					<CheckSquare class="h-6 w-6" />
					<h3 class="text-2xl font-semibold text-black">My Tasks</h3>
					<span class="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
						{userTasks.length}
					</span>
				</div>

				{#if userTasks.length === 0}
					<div class="flex h-32 flex-col items-center justify-center text-center">
						<CheckSquare class="mb-2 h-8 w-8 text-gray-400" />
						<p class="text-zinc-600">No active tasks assigned to you</p>
					</div>
				{:else}
					<div class="space-y-3">
						{#each userTasks as task}
							<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
								<div class="flex items-start justify-between">
									<div class="flex-1">
										<h4 class="font-medium text-black">{task.title}</h4>
										{#if task.description}
											<p class="mt-1 text-sm text-zinc-600">{task.description}</p>
										{/if}
										{#if task.project}
											<p class="mt-2 text-xs text-zinc-500">
												Project: {task.project.name}
											</p>
										{/if}
									</div>
									<TaskPill status={task.status} />
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
