<script lang="ts">
	import '../app.css';
	import LoginRequired from '$lib/components/auth/LoginRequired.svelte';

	let { children } = $props();
</script>

<LoginRequired>
	{@render children()}
</LoginRequired>
