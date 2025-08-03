<script lang="ts">
	import { onMount } from 'svelte';
	import { FolderOpen, Users, Calendar, CheckSquare } from '@lucide/svelte';
	import ProjectsTab from './browser/ProjectsTab.svelte';
	import PeopleTab from './browser/PeopleTab.svelte';
	import TimelineTab from './browser/TimelineTab.svelte';
	import TaskTab from './browser/TaskTab.svelte';
	import { ServiceFactory } from '../services/ServiceFactory';
	import type { IProjectsService } from '../services/interfaces';

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
</script>

<div class="flex h-screen w-full bg-zinc-950">
	<!-- Sidebar -->
	<div class="flex w-64 flex-col border-r border-zinc-800 bg-zinc-900">
		<!-- Header -->
		<div class="border-b border-zinc-800 p-6">
			<h1 class="text-xl font-semibold text-zinc-100">🛸 BORG</h1>
			<!-- <p class="mt-1 text-sm text-zinc-400">MIT Media Lab</p> -->

			<!-- Status Counts -->
			<div class="mt-4 space-y-2">
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
			</div>
		</div>

		<!-- Navigation Tabs -->
		<nav class="flex-1 p-4">
			<div class="space-y-2">
				<button
					onclick={() => setActiveTab('projects')}
					class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors {activeTab ===
					'projects'
						? 'bg-zinc-800 text-zinc-100'
						: 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'}"
				>
					<FolderOpen class="h-5 w-5" />
					Projects
				</button>

				<button
					onclick={() => setActiveTab('people')}
					class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors {activeTab ===
					'people'
						? 'bg-zinc-800 text-zinc-100'
						: 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'}"
				>
					<Users class="h-5 w-5" />
					People
				</button>

				<button
					onclick={() => setActiveTab('timeline')}
					class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors {activeTab ===
					'timeline'
						? 'bg-zinc-800 text-zinc-100'
						: 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'}"
				>
					<Calendar class="h-5 w-5" />
					Timeline
				</button>

				<button
					onclick={() => setActiveTab('tasks')}
					class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors {activeTab ===
					'tasks'
						? 'bg-zinc-800 text-zinc-100'
						: 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'}"
				>
					<CheckSquare class="h-5 w-5" />
					Tasks
				</button>
			</div>
		</nav>
	</div>

	<!-- Main Content -->
	<div class="flex flex-1 flex-col">
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
