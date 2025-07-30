<script lang="ts">
	import Canvas from '$lib/Canvas.svelte';
	import { SvelteFlowProvider } from '@xyflow/svelte';
</script>

<div class="h-screen w-full">
	<SvelteFlowProvider>
		<Canvas />
	</SvelteFlowProvider>
</div>
