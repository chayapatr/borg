<script lang="ts">
	import '../app.css';
	import { ServiceFactory } from '$lib/services/ServiceFactory';
	import LoginRequired from '$lib/components/auth/LoginRequired.svelte';

	let { children } = $props();

	// Check if we're using Firebase mode
	const isFirebaseMode = ServiceFactory.isUsingFirebase();
</script>

{#if isFirebaseMode}
	<!-- Wrap with authentication when using Firebase -->
	<LoginRequired>
		{@render children()}
	</LoginRequired>
{:else}
	<!-- Direct access when using localStorage -->
	{@render children()}
{/if}
