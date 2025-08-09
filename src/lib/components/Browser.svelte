<script lang="ts">
	import { onMount } from 'svelte';
	import { FolderOpen, Users, Calendar, CheckSquare, LogOut, BookOpen, User } from '@lucide/svelte';
	import ProjectsTab from './browser/ProjectsTab.svelte';
	import PeopleTab from './browser/PeopleTab.svelte';
	import TimelineTab from './browser/TimelineTab.svelte';
	import TaskTab from './browser/TaskTab.svelte';
	import PersonalTab from './browser/PersonalTab.svelte';
	import { ServiceFactory } from '../services/ServiceFactory';
	import type {
		IProjectsService,
		ITaskService,
		IPeopleService,
		ITimelineService
	} from '../services/interfaces';

	import { firebaseAuth } from '../stores/authStore';

	type Tab = 'projects' | 'people' | 'timeline' | 'tasks' | 'personal' | 'resources';

	let activeTab = $state<Tab>('projects');

	// Shared services - created once and passed to children
	let projectsService: IProjectsService;
	let taskService: ITaskService;
	let peopleService: IPeopleService;
	let timelineService: ITimelineService;

	let globalCounts = $state({ todo: 0, doing: 0, done: 0 });
	let servicesInitialized = $state(false);
	let cachedProjects = $state<any[]>([]);

	onMount(() => {
		// Initialize all services once
		projectsService = ServiceFactory.createProjectsService();
		taskService = ServiceFactory.createTaskService();
		peopleService = ServiceFactory.createPeopleService();
		timelineService = ServiceFactory.createTimelineService();

		servicesInitialized = true;

		// Only load data for the initial tab (projects)
		if (activeTab === 'projects') {
			updateGlobalCounts();
		}

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

		// Trigger global counts update when switching to projects tab
		if (tab === 'projects' && servicesInitialized) {
			updateGlobalCounts();
		}
	}

	async function updateGlobalCounts(forceRefresh = false) {
		if (projectsService) {
			// Load projects once and reuse for counts (unless forced to refresh)
			if (cachedProjects.length === 0 || forceRefresh) {
				cachedProjects = await projectsService.getAllProjects();
			}

			// Calculate counts from cached projects to avoid duplicate getAllProjects call
			const counts = { todo: 0, doing: 0, done: 0 };
			for (const project of cachedProjects) {
				const projectCounts = await projectsService.getProjectStatusCounts(project.slug);
				counts.todo += projectCounts.todo;
				counts.doing += projectCounts.doing;
				counts.done += projectCounts.done;
			}
			globalCounts = counts;
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

				<button
					onclick={() => setActiveTab('personal')}
					class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors {activeTab ===
					'personal'
						? 'bg-black text-white '
						: 'hover:bg-borg-orange hover:text-white'}"
				>
					<User class="h-5 w-5" />
					Personal
				</button>

				<button
					onclick={() => window.open('https://borg.cyborglab.org/project/lab-resources', '_blank')}
					class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-borg-orange hover:text-white"
				>
					<BookOpen class="h-5 w-5" />
					Resources
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
		{#if servicesInitialized}
			{#if activeTab === 'projects'}
				<ProjectsTab {projectsService} {cachedProjects} onCountsUpdate={updateGlobalCounts} />
			{:else if activeTab === 'people'}
				<PeopleTab {peopleService} {taskService} {activeTab} />
			{:else if activeTab === 'timeline'}
				<TimelineTab {timelineService} {activeTab} />
			{:else if activeTab === 'tasks'}
				<TaskTab {taskService} {peopleService} {activeTab} />
			{:else if activeTab === 'personal'}
				<PersonalTab {taskService} {activeTab} />
			{/if}
		{:else}
			<div class="flex h-screen w-full items-center justify-center">
				<div class="text-center">
					<div
						class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent"
					></div>
					<p class="text-zinc-600">Initializing services...</p>
				</div>
			</div>
		{/if}
	</div>
</div>
