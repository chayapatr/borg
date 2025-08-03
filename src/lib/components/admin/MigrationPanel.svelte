<script lang="ts">
	import { DataMigration } from '../../services/migration/DataMigration';
	import { ServiceFactory } from '../../services/ServiceFactory';
	
	let isLoading = $state(false);
	let migrationStatus = $state<string | null>(null);
	let migrationData = $state<{ hasLocalData: boolean; localDataCounts: { projects: number; tasks: number; people: number } } | null>(null);
	
	const migration = new DataMigration();

	async function checkMigrationStatus() {
		try {
			migrationData = await migration.checkMigrationStatus();
		} catch (error) {
			console.error('Failed to check migration status:', error);
		}
	}

	async function startMigration() {
		isLoading = true;
		migrationStatus = null;
		
		try {
			await migration.migrateAllData();
			migrationStatus = 'Migration completed successfully! You can now switch to Firebase mode.';
			await checkMigrationStatus();
		} catch (error) {
			migrationStatus = `Migration failed: ${(error as Error).message}`;
		} finally {
			isLoading = false;
		}
	}

	async function exportCurrentData() {
		try {
			const data = await migration.exportCurrentData();
			
			// Download as JSON
			const blob = new Blob([JSON.stringify(data, null, 2)], { 
				type: 'application/json' 
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `borg-data-export-${new Date().toISOString().split('T')[0]}.json`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Export failed:', error);
			migrationStatus = `Export failed: ${(error as Error).message}`;
		}
	}

	// Check status on mount
	checkMigrationStatus();
</script>

<div class="p-6 bg-zinc-900 rounded-lg border border-zinc-700">
	<h2 class="text-xl font-bold text-zinc-100 mb-4">Data Migration</h2>
	
	<div class="mb-4 p-4 bg-zinc-800 rounded-lg">
		<h3 class="text-lg font-semibold text-zinc-200 mb-2">Current Status</h3>
		<p class="text-sm text-zinc-400 mb-2">Service Mode: <span class="font-semibold text-zinc-200">{ServiceFactory.getCurrentMode()}</span></p>
		
		{#if migrationData}
			<div class="space-y-2">
				<p class="text-sm text-zinc-400">
					Local Data Available: 
					<span class="font-semibold {migrationData.hasLocalData ? 'text-green-400' : 'text-zinc-400'}">
						{migrationData.hasLocalData ? 'Yes' : 'No'}
					</span>
				</p>
				
				{#if migrationData.hasLocalData}
					<div class="text-xs text-zinc-500 space-y-1">
						<div>Projects: {migrationData.localDataCounts.projects}</div>
						<div>Tasks: {migrationData.localDataCounts.tasks}</div>
						<div>People: {migrationData.localDataCounts.people}</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
	
	<div class="space-y-4">
		<button
			onclick={exportCurrentData}
			class="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg transition-colors"
		>
			Export Current Data
		</button>
		
		<button
			onclick={startMigration}
			disabled={isLoading || !migrationData?.hasLocalData}
			class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
		>
			{isLoading ? 'Migrating...' : 'Migrate to Firebase'}
		</button>
		
		{#if !migrationData?.hasLocalData}
			<p class="text-xs text-zinc-500">Migration is only available when local data exists</p>
		{/if}
		
		{#if migrationStatus}
			<div class="p-3 rounded-lg {migrationStatus.includes('failed') ? 'bg-red-900 text-red-100' : 'bg-green-900 text-green-100'}">
				{migrationStatus}
			</div>
		{/if}
	</div>
	
	<div class="mt-6 p-4 bg-zinc-800 rounded-lg">
		<h3 class="text-lg font-semibold text-zinc-200 mb-2">How to Switch Modes</h3>
		<div class="text-sm text-zinc-400 space-y-2">
			<p>1. <strong>Local Mode:</strong> Set <code class="bg-zinc-700 px-1 rounded">VITE_SERVICE_MODE=local</code> in your .env file</p>
			<p>2. <strong>Firebase Mode:</strong> Set <code class="bg-zinc-700 px-1 rounded">VITE_SERVICE_MODE=firebase</code> in your .env file</p>
			<p class="text-xs text-zinc-500">Restart the development server after changing the mode.</p>
		</div>
	</div>
</div>