<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { getTemplate, type NodeTemplate } from '../../templates';
	import NoteNode from './NoteNode.svelte';
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

	// Listen for global task updates
	$effect(() => {
		const handleTasksUpdated = () => {
			console.log('UniversalNode: Received tasksUpdated event for node:', id);
			refreshTrigger += 1;
		};

		document.addEventListener('tasksUpdated', handleTasksUpdated);

		return () => {
			document.removeEventListener('tasksUpdated', handleTasksUpdated);
		};
	});

	// Load tasks when component mounts or data changes
	$effect(() => {
		// Include refreshTrigger in dependencies to trigger on task updates
		refreshTrigger;

		(async () => {
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

			const nodeTasksResult = projectSlug
				? taskService.getNodeTasks(id, projectSlug)
				: taskService.getNodeTasks(id);

			const nodeTasks =
				nodeTasksResult instanceof Promise ? await nodeTasksResult : nodeTasksResult;

			// Debug log to see what's happening
			console.log(
				`UniversalNode: Node ${id} loaded ${nodeTasks.length} tasks (trigger: ${refreshTrigger}):`,
				nodeTasks
			);

			tasks = nodeTasks;
		})();
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
{:else}
	<div>
		<!-- Project Node Header (outside the main node box) -->
		{#if template.id === 'project'}
			<NodeHeader
				{template}
				templateType={data.templateType}
				{nodeData}
				onDelete={handleDelete}
			/>
		{/if}

		<div
			class="group relative cursor-pointer border transition-all duration-200 {template.id === 'note'
				? `aspect-square ${nodeSizeClass} rounded-lg p-1`
				: 'max-w-64 min-w-48'} {hasTasks && template.id !== 'note' ? 'rounded-t-lg' : 'rounded-lg'}"
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
				<Handle type="target" position={Position.Left} class="!bg-zinc-600" />
				<Handle type="source" position={Position.Right} class="!bg-zinc-600" />
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
