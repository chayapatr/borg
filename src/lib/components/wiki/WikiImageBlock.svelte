<script lang="ts">
	import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
	import { app } from '$lib/firebase/config';
	import { X, ImageIcon } from '@lucide/svelte';

	interface Props {
		imageUrl: string;
		onDelete?: () => void;
	}

	let { imageUrl, onDelete }: Props = $props();

	const storage = getStorage(app);
	let uploading = $state(false);
	let uploadProgress = $state('');
	let currentUrl = $state(imageUrl);

	$effect(() => { currentUrl = imageUrl; });

	export async function uploadFile(file: File): Promise<string> {
		uploading = true;
		uploadProgress = 'Uploading...';
		try {
			const timestamp = Date.now();
			const storageRef = ref(storage, `wiki-images/${timestamp}_${file.name}`);
			const snapshot = await uploadBytes(storageRef, file);
			const url = await getDownloadURL(snapshot.ref);
			currentUrl = url;
			uploading = false;
			return url;
		} catch (e) {
			uploading = false;
			uploadProgress = '';
			throw e;
		}
	}
</script>

<div class="group relative my-1 w-full">
	{#if uploading}
		<div class="flex h-32 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-400">
			<div class="flex flex-col items-center gap-2">
				<div class="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600"></div>
				<span>{uploadProgress}</span>
			</div>
		</div>
	{:else if currentUrl}
		<img
			src={currentUrl}
			alt=""
			class="w-full rounded-lg object-contain"
			style="max-height: 600px;"
		/>
		{#if onDelete}
			<button
				class="absolute right-2 top-2 hidden rounded bg-white/80 p-1 text-zinc-500 shadow hover:bg-white hover:text-black group-hover:flex"
				onclick={onDelete}
				title="Remove image"
			>
				<X class="h-4 w-4" />
			</button>
		{/if}
	{:else}
		<div class="flex h-32 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-400">
			<ImageIcon class="h-6 w-6" />
		</div>
	{/if}
</div>
