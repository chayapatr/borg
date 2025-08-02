<script lang="ts">
	import { onMount } from 'svelte';
	import { FolderOpen, Users, Calendar } from '@lucide/svelte';
	import ProjectsTab from './browser/ProjectsTab.svelte';
	import PeopleTab from './browser/PeopleTab.svelte';
	import TimelineTab from './browser/TimelineTab.svelte';

	type Tab = 'projects' | 'people' | 'timeline';

	let activeTab = $state<Tab>('projects');

	function setActiveTab(tab: Tab) {
		activeTab = tab;
	}
</script>

<div class="flex h-screen w-full bg-zinc-950">
	<!-- Sidebar -->
	<div class="flex w-64 flex-col border-r border-zinc-800 bg-zinc-900">
		<!-- Header -->
		<div class="border-b border-zinc-800 p-6">
			<h1 class="text-xl font-semibold text-zinc-100">🤖 Borg</h1>
			<!-- <p class="mt-1 text-sm text-zinc-400">MIT Media Lab</p> -->
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
			</div>
		</nav>
	</div>

	<!-- Main Content -->
	<div class="flex flex-1 flex-col">
		{#if activeTab === 'projects'}
			<ProjectsTab />
		{:else if activeTab === 'people'}
			<PeopleTab />
		{:else if activeTab === 'timeline'}
			<TimelineTab />
		{/if}
	</div>
</div>
