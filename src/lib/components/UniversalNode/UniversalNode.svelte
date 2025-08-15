<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { getTemplate, type NodeTemplate } from '../../templates';
	import NoteNode from './NoteNode.svelte';
	import StickerNode from './StickerNode.svelte';
	import NodeHeader from './components/NodeHeader.svelte';
	import NodeContent from './components/NodeContent.svelte';
	import NodeTasks from './components/NodeTasks.svelte';
	import { ServiceFactory } from '../../services/ServiceFactory';
	import type { ITaskService } from '../../services/interfaces/ITaskService';
	import type { Task } from '../../types/task';

	let { data, id } = $props<{ data: any; id: string }>();

	let template: NodeTemplate = $derived(getTemplate(data.templateType || 'blank'));
	let nodeData = $derived(data.nodeData || {});

	// Get note size setting with default (current = Small)
	let size = $derived(nodeData.size || 'Small');

	// Node size classes for post-it notes
	let nodeSizeClass = $derived.by(() => {
		if (template.id !== 'note') return '';
		switch (size) {
			case 'Small':
				return 'max-h-32 min-h-24 max-w-32 min-w-24';
			case 'Medium':
				return 'max-h-40 min-h-32 max-w-40 min-w-32';
			case 'Large':
				return 'max-h-48 min-h-40 max-w-48 min-w-40';
			default:
				return 'max-h-32 min-h-24 max-w-32 min-w-24';
		}
	});

	// Task-related state
	const taskService: ITaskService = ServiceFactory.createTaskService();

	// Title inline editing state
	let isEditingTitle = $state(false);

	// Get tasks for this node from TaskService instead of embedded data
	let tasks = $state<Task[]>([]);
	let hasTasks = $derived(tasks.length > 0);

	// Reactive flag to trigger task refresh
	let refreshTrigger = $state(0);

	// Removed global task update listener - Firebase subscriptions handle updates automatically
	// Task counts will update when Firebase data changes via the Canvas subscriptions

	// Track subscription state to prevent unnecessary recreations
	let currentSubscription: (() => void) | null = null;
	let subscribedNodeId = '';
	let subscribedProjectSlug = '';
	let isSubscriptionSetup = false;

	// Use Firebase subscription for real-time task updates
	$effect(() => {
		// Get project slug from data if available, otherwise extract from URL
		const projectSlug =
			data.projectSlug ||
			(() => {
				if (typeof window !== 'undefined') {
					const currentPath = window.location.pathname;
					const pathParts = currentPath.split('/');
					return pathParts[2]; // /project/[slug]/...
				}
				return null;
			})();

		const currentNodeId = id;
		const currentProjectSlug = projectSlug || '';

		// Only setup subscription if node ID or project actually changed
		if (
			isSubscriptionSetup &&
			subscribedNodeId === currentNodeId &&
			subscribedProjectSlug === currentProjectSlug
		) {
			console.log(
				`UniversalNode: Subscription already exists for node ${currentNodeId}, skipping setup`
			);
			return; // Already subscribed to this exact node/project combination
		}

		// Cleanup existing subscription if parameters changed
		if (
			currentSubscription &&
			(subscribedNodeId !== currentNodeId || subscribedProjectSlug !== currentProjectSlug)
		) {
			console.log(
				`UniversalNode: Cleaning up subscription for node ${subscribedNodeId} (switching to ${currentNodeId})`
			);
			currentSubscription();
			currentSubscription = null;
			isSubscriptionSetup = false;
		}

		// Use subscription if available, otherwise fallback to one-time fetch
		if ((taskService as any).subscribeToNodeTasks) {
			console.log(
				`UniversalNode: Setting up real-time task subscription for node ${currentNodeId}`
			);

			const unsubscribe = (taskService as any).subscribeToNodeTasks(
				currentNodeId,
				(updatedTasks: Task[]) => {
					console.log(
						`UniversalNode: Node ${currentNodeId} received ${updatedTasks.length} tasks via subscription`
					);
					tasks = updatedTasks;
				},
				projectSlug
			);

			currentSubscription = unsubscribe;
			subscribedNodeId = currentNodeId;
			subscribedProjectSlug = currentProjectSlug;
			isSubscriptionSetup = true;

			// Cleanup subscription when component unmounts
			return () => {
				if (currentSubscription) {
					console.log(`UniversalNode: Cleaning up task subscription for node ${currentNodeId}`);
					currentSubscription();
					currentSubscription = null;
					subscribedNodeId = '';
					subscribedProjectSlug = '';
					isSubscriptionSetup = false;
				}
			};
		} else {
			// Fallback to one-time fetch for non-Firebase services
			(async () => {
				const nodeTasksResult = projectSlug
					? taskService.getNodeTasks(currentNodeId, projectSlug)
					: taskService.getNodeTasks(currentNodeId);

				const nodeTasks =
					nodeTasksResult instanceof Promise ? await nodeTasksResult : nodeTasksResult;

				console.log(
					`UniversalNode: Node ${currentNodeId} loaded ${nodeTasks.length} tasks (one-time fetch)`
				);
				tasks = nodeTasks;
			})();
		}
	});

	// Determine border color based on status
	let borderColor = $derived.by(() => {
		const status = nodeData.status;
		if (status === 'To Do') return '#9333ea'; // purple-600
		if (status === 'Doing') return '#0284c7'; // sky-600
		if (status === 'Done') return '#16a34a'; // green-600
		return '#3f3f46'; // zinc-700 - default
	});

	function handleNodeClick() {
		// Dispatch the edit event
		const event = new CustomEvent('nodeEdit', {
			detail: {
				nodeId: id,
				nodeData: nodeData,
				templateType: data.templateType
			}
		});
		document.dispatchEvent(event);
	}

	function handleTitleSave(title: string) {
		// Update the data prop immediately to reflect changes
		data.nodeData = {
			...nodeData,
			title: title
		};

		// Dispatch update event to save the title to service
		const event = new CustomEvent('nodeUpdate', {
			detail: {
				nodeId: id,
				data: {
					nodeData: {
						...nodeData,
						title: title
					}
				}
			}
		});
		document.dispatchEvent(event);
	}

	function handleDelete() {
		// Dispatch a custom event to parent
		const event = new CustomEvent('nodeDelete', { detail: { nodeId: id } });
		document.dispatchEvent(event);
	}

	function handleTaskPillClick() {
		// Dispatch event to open task sidebar at Canvas level
		const customEvent = new CustomEvent('nodeTasksOpen', {
			detail: {
				nodeId: id,
				nodeTitle: nodeData.title || 'Untitled',
				tasks: tasks
			}
		});
		document.dispatchEvent(customEvent);
	}
</script>

{#if template.id === 'note'}
	<!-- Delegate entirely to NoteNode for note types -->
	<NoteNode {data} {id} />
{:else if template.id === 'sticker'}
	<!-- Delegate entirely to StickerNode for sticker types -->
	<StickerNode {data} {id} />
{:else}
	<div>
		<!-- Project Node Header (outside the main node box) -->
		{#if template.id === 'project'}
			<NodeHeader {template} templateType={data.templateType} {nodeData} onDelete={handleDelete} />
		{/if}

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			onclick={handleNodeClick}
			class="group relative cursor-pointer border transition-all duration-200 {template.id ===
			'note'
				? `aspect-square ${nodeSizeClass} rounded-lg p-1`
				: 'max-w-64 min-w-48'} {template.id !== 'note' ? 'rounded-t-lg' : 'rounded-lg'}"
			style="box-shadow: {template.id === 'note'
				? '0;'
				: '0;'}; border-color: {borderColor}; background-color: {template.id === 'note' &&
			nodeData.backgroundColor
				? nodeData.backgroundColor
				: template.id === 'note'
					? '#fef08a'
					: 'white'};"
		>
			<!-- Non-Project Node Header (inside the node box) -->
			{#if template.id !== 'note' && template.id !== 'project'}
				<NodeHeader
					{template}
					templateType={data.templateType}
					{nodeData}
					onDelete={handleDelete}
				/>
			{/if}

			<div class={template.id === 'note' ? '' : template.id === 'project' ? 'p-3' : 'p-3 pt-0'}>
				<!-- Node Content -->
				<NodeContent
					{template}
					{nodeData}
					templateType={data.templateType}
					bind:isEditingTitle
					onTitleSave={handleTitleSave}
					onNodeClick={handleNodeClick}
				/>

				<!-- Connection Handles -->
				<Handle type="target" position={Position.Left} class="!h-2 !w-2 !bg-zinc-600" />
				<Handle type="source" position={Position.Right} class="!h-2 !w-2 !bg-zinc-600" />
			</div>
		</div>

		<!-- Tasks Management (outside/below the main node) -->
		{#if template.id !== 'note'}
			<NodeTasks
				{tasks}
				{borderColor}
				onTaskClick={handleTaskPillClick}
				onAddTaskClick={handleTaskPillClick}
			/>
		{/if}
	</div>
{/if}
