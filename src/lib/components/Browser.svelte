<script lang="ts">
	import { onMount } from 'svelte';
	import { FolderOpen, Users, Calendar, CheckSquare, LogOut } from '@lucide/svelte';
	import ProjectsTab from './browser/ProjectsTab.svelte';
	import PeopleTab from './browser/PeopleTab.svelte';
	import TimelineTab from './browser/TimelineTab.svelte';
	import TaskTab from './browser/TaskTab.svelte';
	import { ServiceFactory } from '../services/ServiceFactory';
	import type { IProjectsService } from '../services/interfaces';

	import { firebaseAuth } from '../stores/authStore';

	type Tab = 'projects' | 'people' | 'timeline' | 'tasks';

	let activeTab = $state<Tab>('projects');
	let projectsService: IProjectsService;
	let globalCounts = $state({ todo: 0, doing: 0, done: 0 });

	onMount(() => {
		projectsService = ServiceFactory.createProjectsService();
		updateGlobalCounts();

		// Update counts when returning from project pages
		const handleVisibilityChange = () => {
			if (!document.hidden) {
				updateGlobalCounts();
			}
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	});

	function setActiveTab(tab: Tab) {
		activeTab = tab;
	}

	async function updateGlobalCounts() {
		if (projectsService) {
			globalCounts = await projectsService.getGlobalStatusCounts();
		}
	}

	async function handleLogout() {
		if (confirm('Are you sure you want to log out?')) {
			await firebaseAuth.signOut();
		}
	}
</script>

<div class="flex h-full min-h-screen w-full bg-borg-white">
	<!-- Sidebar -->
	<div
		class="fixed flex h-screen min-h-screen w-64 flex-col border-r border-zinc-800 bg-borg-brown"
	>
		<!-- Header -->
		<div class="p-6">
			<img src="BORG.svg" class="w-3/4" alt="" />
			<!-- <p class="mt-1 text-sm text-zinc-400">MIT Media Lab</p> -->

			<!-- Status Counts -->
			<!-- <div class="mt-4 space-y-2">
				<div class="flex items-center justify-between text-sm">
					<span class="text-zinc-400">To Do</span>
					<span class="rounded-full bg-purple-500/20 px-2 py-1 text-xs text-purple-400"
						>{globalCounts.todo}</span
					>
				</div>
				<div class="flex items-center justify-between text-sm">
					<span class="text-zinc-400">Doing</span>
					<span class="rounded-full bg-blue-500/20 px-2 py-1 text-xs text-blue-400"
						>{globalCounts.doing}</span
					>
				</div>
				<div class="flex items-center justify-between text-sm">
					<span class="text-zinc-400">Done</span>
					<span class="rounded-full bg-green-500/20 px-2 py-1 text-xs text-green-400"
						>{globalCounts.done}</span
					>
				</div>
			</div> -->
		</div>

		<!-- Navigation Tabs -->
		<nav class="flex flex-1 flex-col justify-between p-4">
			<div class="space-y-2 font-semibold">
				<button
					onclick={() => setActiveTab('projects')}
					class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors {activeTab ===
					'projects'
						? 'bg-black text-white '
						: 'hover:bg-borg-orange hover:text-white'}"
				>
					<FolderOpen class="h-5 w-5" />
					Projects
				</button>

				<button
					onclick={() => setActiveTab('people')}
					class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors {activeTab ===
					'people'
						? 'bg-black text-white '
						: 'hover:bg-borg-orange hover:text-white'}"
				>
					<Users class="h-5 w-5" />
					People
				</button>

				<button
					onclick={() => setActiveTab('timeline')}
					class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors {activeTab ===
					'timeline'
						? 'bg-black text-white '
						: 'hover:bg-borg-orange hover:text-white'}"
				>
					<Calendar class="h-5 w-5" />
					Timeline
				</button>

				<button
					onclick={() => setActiveTab('tasks')}
					class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors {activeTab ===
					'tasks'
						? 'bg-black text-white '
						: 'hover:bg-borg-orange hover:text-white'}"
				>
					<CheckSquare class="h-5 w-5" />
					Tasks
				</button>
			</div>
			<button
				onclick={handleLogout}
				class="flex w-fit grow-0 items-center gap-1
        rounded-md border border-black bg-white px-3 py-1.5
        text-black transition-colors hover:bg-borg-beige"
				title="Log out"
			>
				<LogOut class="h-3 w-3" />
				<span>Log out</span>
			</button>
		</nav>
	</div>

	<!-- Main Content -->
	<div class="ml-64 flex h-screen flex-1">
		{#if activeTab === 'projects'}
			<ProjectsTab onCountsUpdate={updateGlobalCounts} />
		{:else if activeTab === 'people'}
			<PeopleTab />
		{:else if activeTab === 'timeline'}
			<TimelineTab />
		{:else if activeTab === 'tasks'}
			<TaskTab />
		{/if}
	</div>
</div>
