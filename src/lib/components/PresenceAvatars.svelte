<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { authStore } from '../stores/authStore';
	import type { User } from 'firebase/auth';

	interface ActiveUser {
		userId: string;
		userName: string;
		photoUrl: string;
		color: string;
		lastSeen: number;
	}

	let { room } = $props<{ room: string }>();

	let activeUsers = $state<Map<string, ActiveUser>>(new Map());
	let ws: WebSocket | null = null;
	let currentUser: User | null = $state(null);
	let userColor = $state('');
	let staleTimer: ReturnType<typeof setInterval> | null = null;

	const STALE_THRESHOLD = 30000; // 30s

	const COLORS = [
		'#ef4444', '#f97316', '#eab308', '#22c55e',
		'#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef',
		'#f43f5e', '#10b981'
	];

	function colorForUser(uid: string): string {
		let hash = 0;
		for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
		return COLORS[Math.abs(hash) % COLORS.length];
	}

	function initials(name: string): string {
		return name
			.split(' ')
			.map((w) => w[0])
			.join('')
			.slice(0, 2)
			.toUpperCase();
	}

	$effect(() => {
		const unsub = authStore.subscribe((auth) => {
			currentUser = auth.user;
			if (auth.user && !userColor) userColor = colorForUser(auth.user.uid);
		});
		return unsub;
	});

	function connect() {
		if (!currentUser || !room) return;
		const wsUrl = `wss://borg-cursors.chayapatr.partykit.dev/party/${room}`;
		ws = new WebSocket(wsUrl);

		ws.onopen = () => {
			sendPresence();
		};

		ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				handleMessage(data);
			} catch {}
		};

		ws.onclose = () => {
			setTimeout(connect, 3000);
		};
	}

	function sendPresence() {
		if (!ws || ws.readyState !== WebSocket.OPEN || !currentUser) return;
		ws.send(JSON.stringify({
			type: 'cursor_update',
			userId: currentUser.uid,
			userName: currentUser.displayName || 'Anonymous',
			photoUrl: currentUser.photoURL || '',
			color: userColor,
			// Dummy position so PartyKit accepts it
			x: 0,
			y: 0,
			pointer: 'mouse'
		}));
	}

	function handleMessage(data: any) {
		if (data.type === 'cursor_update' || data.type === 'presence_update') {
			if (data.userId === currentUser?.uid) return;
			upsertUser(data);
		} else if (data.type === 'cursors_sync') {
			(data.cursors as any[]).forEach((c) => {
				if (c.userId !== currentUser?.uid) upsertUser(c);
			});
		} else if (data.type === 'user_left') {
			activeUsers.delete(data.userId);
			activeUsers = new Map(activeUsers);
		}
	}

	function upsertUser(data: any) {
		activeUsers.set(data.userId, {
			userId: data.userId,
			userName: data.userName || 'Anonymous',
			photoUrl: data.photoUrl || '',
			color: data.color || colorForUser(data.userId),
			lastSeen: Date.now()
		});
		activeUsers = new Map(activeUsers);
	}

	function cleanStale() {
		const now = Date.now();
		for (const [uid, u] of activeUsers) {
			if (now - u.lastSeen > STALE_THRESHOLD) activeUsers.delete(uid);
		}
		activeUsers = new Map(activeUsers);
	}

	onMount(() => {
		connect();
		// Heartbeat: re-send presence every 10s so others know we're alive
		const heartbeat = setInterval(sendPresence, 10000);
		staleTimer = setInterval(cleanStale, 10000);
		return () => {
			clearInterval(heartbeat);
		};
	});

	onDestroy(() => {
		if (staleTimer) clearInterval(staleTimer);
		if (ws) ws.close();
	});

	$effect(() => {
		if (currentUser && room && !ws) connect();
	});

	let others = $derived(Array.from(activeUsers.values()));
</script>

<!-- Active users avatars -->
<div class="flex items-center gap-1">
	{#each others as user (user.userId)}
		<div class="relative group" title={user.userName}>
			{#if user.photoUrl}
				<img
					src={user.photoUrl}
					alt={user.userName}
					class="h-7 w-7 rounded-full ring-2 ring-white object-cover"
					style="ring-color: {user.color}"
				/>
			{:else}
				<div
					class="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white"
					style="background-color: {user.color}"
				>
					{initials(user.userName)}
				</div>
			{/if}
			<!-- Tooltip -->
			<div class="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
				{user.userName}
			</div>
		</div>
	{/each}
</div>
