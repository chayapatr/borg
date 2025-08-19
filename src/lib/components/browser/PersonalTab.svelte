<script lang="ts">
	import { User, CheckSquare, Edit, Check, X } from '@lucide/svelte';
	import type { ITaskService } from '../../services/interfaces/ITaskService';
	import type { TaskWithContext } from '../../types/task';
	import { authStore } from '../../stores/authStore';
	import { doc, updateDoc, getDoc } from 'firebase/firestore';
	import { db } from '../../firebase/config';
	import HierarchicalTaskView from '../tasks/HierarchicalTaskView.svelte';

	let { taskService, activeTab } = $props<{
		taskService: ITaskService;
		activeTab: string;
	}>();

	let userTasks = $state<TaskWithContext[]>([]);
	let resolvedUserTasks = $state<TaskWithContext[]>([]);
	let viewTab = $state<'active' | 'resolved'>('active');
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
			loadResolvedUserTasks();
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
			// In Firebase mode, person ID is the user's Firebase UID
			// In local mode, it might be email or another identifier
			let personId = currentUser.uid || currentUser.email || '';

			const result = taskService.getPersonTasks(personId);
			const tasks = result instanceof Promise ? await result : result;
			userTasks = tasks.filter((task: any) => !task.resolvedAt);
		} catch (error) {
			console.error('Failed to load user tasks:', error);
			userTasks = [];
		}
	}

	async function loadResolvedUserTasks() {
		const currentUser = $authStore.user;
		if (!currentUser) return;

		try {
			let personId = currentUser.uid || currentUser.email || '';

			// Get all resolved tasks and filter by person
			const result = taskService.getResolvedTasks();
			const allResolvedTasks = result instanceof Promise ? await result : result;
			resolvedUserTasks = allResolvedTasks.filter((task: any) => task.assignee === personId);
		} catch (error) {
			console.error('Failed to load resolved user tasks:', error);
			resolvedUserTasks = [];
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

	// Task handlers
	async function handleDeleteTask(task: TaskWithContext) {
		if (confirm('Are you sure you want to delete this task permanently?')) {
			const result = taskService.deleteTask(task.nodeId, task.id, task.projectSlug);
			if (result instanceof Promise) await result;
			await loadUserTasks(); // Reload tasks
		}
	}

	async function handleResolveTask(task: TaskWithContext) {
		const result = taskService.resolveTask(task.nodeId, task.id, task.projectSlug);
		if (result instanceof Promise) await result;
		await loadUserTasks();
		await loadResolvedUserTasks();
	}

	async function handleReactivateTask(task: TaskWithContext) {
		const result = taskService.updateTask(
			task.nodeId,
			task.id,
			{ status: 'active' } as any,
			task.projectSlug
		);
		if (result instanceof Promise) await result;
		await loadUserTasks();
		await loadResolvedUserTasks();
	}
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
		<div class="flex-1 overflow-y-auto">
			<!-- Personal Profile Card -->
			<div class="box-shadow-black mx-6 mt-6 mb-6 rounded-lg border border-zinc-800 bg-white p-6">
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
			<div class="mt-8 flex items-center justify-between px-6">
				<div class="flex items-center gap-3">
					<CheckSquare class="h-6 w-6" />
					<h3 class="text-2xl font-semibold text-black">My Tasks</h3>
				</div>
				<div class="flex items-center gap-4">
					<div class="flex items-center gap-1">
						<span class="text-xs text-black">Active</span>
						<span class="rounded-full bg-borg-orange px-2 py-1 text-xs text-white">
							{userTasks.length}
						</span>
					</div>
					<div class="flex items-center gap-1">
						<span class="text-xs text-black">Resolved</span>
						<span class="rounded-full bg-green-600 px-2 py-1 text-xs text-white">
							{resolvedUserTasks.length}
						</span>
					</div>
				</div>
			</div>

			<!-- Tab Navigation -->
			<div class="mt-4 px-6">
				<div class="flex border-b border-zinc-200">
					<button
						onclick={() => (viewTab = 'active')}
						class="px-4 py-2 text-sm font-medium transition-colors {viewTab === 'active'
							? 'border-b-2 border-borg-orange text-borg-orange'
							: 'text-zinc-500 hover:text-zinc-700'}"
					>
						Active Tasks ({userTasks.length})
					</button>
					<button
						onclick={() => (viewTab = 'resolved')}
						class="px-4 py-2 text-sm font-medium transition-colors {viewTab === 'resolved'
							? 'border-b-2 border-green-600 text-green-600'
							: 'text-zinc-500 hover:text-zinc-700'}"
					>
						Resolved Tasks ({resolvedUserTasks.length})
					</button>
				</div>
			</div>

			<div class="p-6 pt-4">
				{#if viewTab === 'active'}
					<HierarchicalTaskView 
						tasks={userTasks} 
						showActions={true} 
						isResolved={false}
						onResolveTask={handleResolveTask}
						onDeleteTask={handleDeleteTask}
					/>
				{:else}
					<HierarchicalTaskView 
						tasks={resolvedUserTasks} 
						showActions={true} 
						isResolved={true}
						onReactivateTask={handleReactivateTask}
						onDeleteTask={handleDeleteTask}
					/>
				{/if}
			</div>
		</div>
	{/if}
</div>
