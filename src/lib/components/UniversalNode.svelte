<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { getTemplate, type NodeTemplate } from '../templates';
	import FieldRenderer from './FieldRenderer.svelte';
	import {
		Trash2,
		ListTodo,
		GitBranch,
		FileText,
		Code,
		Calendar,
		StickyNote,
		HardDrive,
		Square,
		CircleDashed,
		PencilRuler,
		CheckCircle
	} from '@lucide/svelte';
	import { ServiceFactory } from '../services/ServiceFactory';
	import type { ITaskService } from '../services/interfaces/ITaskService';
	import type { Task } from '../types/task';

	let { data, id } = $props<{ data: any; id: string }>();

	let template: NodeTemplate = $derived(getTemplate(data.templateType || 'blank'));
	let nodeData = $derived(data.nodeData || {});

	// Get note size setting with default (current = Small)
	let size = $derived(nodeData.size || 'Small');

	// Combined font and node size classes based on single size property
	let fontSizeClass = $derived.by(() => {
		switch (size) {
			case 'Small':
				return 'text-sm';
			case 'Medium':
				return 'text-lg';
			case 'Large':
				return 'text-2xl';
			default:
				return 'text-sm';
		}
	});

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
		if (status === 'To Do') return '#9333ea'; // purple-600 - planned, future potential
		if (status === 'Doing') return '#0284c7'; // sky-600 - active, engaged
		if (status === 'Done') return '#16a34a'; // green-600 - success, completion
		return '#3f3f46'; // zinc-700 - default
	});

	// Create dynamic box-shadow based on status
	let boxShadow = $derived.by(() => {
		const status = nodeData.status;
		if (status === 'To Do') return '3px 3px 0px #9333ea'; // purple-600 shadow
		if (status === 'Doing') return '3px 3px 0px #0284c7'; // sky-600 shadow
		if (status === 'Done') return '3px 3px 0px #16a34a'; // green-600 shadow
		return '3px 3px 0px #000'; // black shadow - default
	});

	// Determine node type icon with status-based color
	let statusIcon = $derived.by(() => {
		const templateType = data.templateType || template.id;
		const status = nodeData.status;

		// Hide icon for project nodes
		if (templateType === 'project') {
			return null;
		}

		// Get icon based on node type
		let component;
		switch (templateType) {
			case 'subproject':
				component = GitBranch;
				break;
			case 'paper':
				component = FileText;
				break;
			case 'code':
				component = Code;
				break;
			case 'time':
				component = Calendar;
				break;
			case 'note':
				component = StickyNote;
				break;
			case 'storage':
				component = HardDrive;
				break;
			case 'blank':
				component = Square;
				break;
			default:
				component = Square;
				break;
		}

		// Get color based on status
		let color;
		if (status === 'To Do')
			color = '#9333ea'; // purple-600
		else if (status === 'Doing')
			color = '#0284c7'; // sky-600
		else if (status === 'Done')
			color = '#16a34a'; // green-600
		else color = '#374151'; // gray-700 - default

		return { component, color };
	});

	function handleNodeClick() {
		// Dispatch a custom event to open the edit panel
		const event = new CustomEvent('nodeEdit', {
			detail: {
				nodeId: id,
				nodeData: nodeData,
				templateType: data.templateType
			}
		});
		document.dispatchEvent(event);
	}

	function handleDelete(event: MouseEvent) {
		event.stopPropagation(); // Prevent triggering the node click

		// Prevent deletion of project nodes (they sync with workspace metadata)
		if (data.templateType === 'project') {
			alert('Project nodes cannot be deleted as they sync with workspace metadata.');
			return;
		}

		if (confirm('Are you sure you want to delete this node?')) {
			// Dispatch a custom event to parent
			const event = new CustomEvent('nodeDelete', { detail: { nodeId: id } });
			document.dispatchEvent(event);
		}
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

	// Get status styling for project nodes
	function getStatusStyling(status: string) {
		switch (status) {
			case 'To Do':
				return {
					icon: CircleDashed,
					color: '#9333ea',
					bgColor: 'bg-purple-100',
					textColor: 'text-purple-800'
				};
			case 'Doing':
				return {
					icon: PencilRuler,
					color: '#0284c7',
					bgColor: 'bg-sky-100',
					textColor: 'text-sky-800'
				};
			case 'Done':
				return {
					icon: CheckCircle,
					color: '#16a34a',
					bgColor: 'bg-green-100',
					textColor: 'text-green-800'
				};
			default:
				return {
					icon: null,
					color: '#374151',
					bgColor: 'bg-gray-100',
					textColor: 'text-gray-800'
				};
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div>
	<!-- Node Header -->
	<!-- {#if template.id !== 'note'}
		<div class="mb-2 flex items-center justify-between">
			<div class="flex items-center gap-2">
				{#if statusIcon}
					{@const StatusIconComponent = statusIcon.component}
					<StatusIconComponent class="h-4 w-4" style="color: {statusIcon.color};" />
				{/if}
				<span class="rounded-md border border-zinc-700 bg-white px-1 py-0.5 text-sm font-medium"
					>{template.name}</span
				>
			</div>

			<div class="flex items-center gap-1">
				{#if data.templateType !== 'project'}
					<button
						onclick={handleDelete}
						aria-label="Delete node"
						class="rounded p-1 text-zinc-500 hover:bg-red-500/30 hover:text-zinc-300"
					>
						<Trash2 class="h-4 w-4" />
					</button>
				{/if}
			</div>
		</div>
	{/if} -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->

	{#if template.id === 'project'}
		<div class="mb-2 flex items-center justify-between">
			<div class="text-xl font-semibold">🏕️ Project</div>
			{#if nodeData.status}
				{@const statusStyle = getStatusStyling(nodeData.status)}
				<div
					class="flex items-center gap-1 rounded border px-1 py-[0.15rem] text-sm font-medium {statusStyle.bgColor} {statusStyle.textColor}"
					style="border-color: {borderColor};"
				>
					{#if statusStyle.icon}
						{@const StatusIcon = statusStyle.icon}
						<StatusIcon class="h-3 w-3" style="color: {statusStyle.color};" />
					{/if}
					<span>{nodeData.status}</span>
				</div>
			{/if}
		</div>
	{/if}

	<div
		class="group relative cursor-pointer border transition-all duration-200 {template.id === 'note'
			? `aspect-square ${nodeSizeClass} rounded-lg p-3`
			: 'max-w-64 min-w-48'} {hasTasks && template.id !== 'note' ? 'rounded-lg' : 'rounded-lg'}"
		style="box-shadow: {template.id === 'note'
			? '0;'
			: '0;'}; border-color: {borderColor}; background-color: {template.id === 'note' &&
		nodeData.backgroundColor
			? nodeData.backgroundColor
			: template.id === 'note'
				? '#fef08a'
				: 'white'};"
		onclick={handleNodeClick}
	>
		{#if template.id !== 'note'}
			<div class="flex items-center justify-between p-3 pb-0">
				<div class="flex items-center gap-2">
					{#if statusIcon}
						{@const StatusIconComponent = statusIcon.component}
						<StatusIconComponent class="h-5 w-5" style="color: {statusIcon.color};" />
					{/if}
					{#if template.id !== 'project'}
						<span class="bg-white text-sm font-medium">{template.name}</span>
					{/if}
				</div>

				<div class="flex items-center gap-1">
					{#if data.templateType !== 'project'}
						<button
							onclick={handleDelete}
							aria-label="Delete node"
							class="rounded p-1 text-zinc-500 hover:bg-borg-orange hover:text-white"
						>
							<Trash2 class="h-4 w-4" />
						</button>
					{/if}
				</div>
			</div>
		{/if}

		<div class={template.id === 'note' ? '' : 'p-3 pt-0'}>
			<!-- Node Content -->
			{#if nodeData.countdownMode && template.id === 'time'}
				<!-- Countdown-only mode: show only event name and countdown -->
				{@const eventField = template.fields.find((f) => f.type === 'timeline-selector')}
				{#if eventField}
					<div class="space-y-3">
						<FieldRenderer
							field={eventField}
							value={nodeData[eventField.id]}
							readonly={true}
							mode="display"
							{nodeData}
							countdownOnly={true}
						/>
					</div>
				{/if}
			{:else if template.id === 'note'}
				<!-- Post-it note style: simple content display -->
				<div
					class="break-word flex h-full w-full items-center justify-center overflow-hidden {fontSizeClass} leading-relaxed text-balance whitespace-pre-wrap text-gray-800"
				>
					{nodeData.content || 'Click to edit...'}
				</div>
				<!-- Delete button for note nodes -->
				<button
					onclick={(event) => {
						event.stopPropagation();
						handleDelete(event);
					}}
					aria-label="Delete note"
					class="absolute top-1 right-1 rounded p-1 text-gray-600 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/50 hover:text-red-600"
				>
					<Trash2 class="h-3 w-3" />
				</button>
			{:else}
				<!-- Normal mode: show all fields -->
				<div class="mt-2 space-y-3">
					{#each template.fields as field}
						{@const isVisible = nodeData.fieldVisibility?.[field.id] ?? field.id === 'title'}
						{#if field.id !== 'status' && isVisible}
							<FieldRenderer
								{field}
								value={nodeData[field.id]}
								readonly={true}
								mode="display"
								{nodeData}
								isProjectTitle={data.templateType === 'project' && field.id === 'title'}
							/>
						{/if}
					{/each}

					{#if nodeData.customFields && Array.isArray(nodeData.customFields)}
						{#each nodeData.customFields as field}
							{@const isVisible = field.showInDisplay ?? field.id === 'title'}
							{#if isVisible && field.id !== 'status'}
								<FieldRenderer
									{field}
									value={nodeData[field.id]}
									readonly={true}
									mode="display"
									{nodeData}
									isProjectTitle={data.templateType === 'project' && field.id === 'title'}
								/>
							{/if}
						{/each}
					{/if}
				</div>
			{/if}

			<!-- Add task button when no tasks (bottom right corner) - exclude post-it notes -->
			{#if !hasTasks && template.id !== 'note'}
				<button
					onclick={(event) => {
						event.stopPropagation();
						handleTaskPillClick();
					}}
					class="absolute -right-2 -bottom-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-black bg-black text-white transition-colors hover:bg-borg-orange hover:text-black"
				>
					<ListTodo class="h-3 w-3" />
				</button>
			{/if}

			<!-- Connection Handles -->
			<Handle type="target" position={Position.Left} class="!bg-zinc-600" />
			<Handle type="source" position={Position.Right} class="!bg-zinc-600" />
		</div>

		<!-- Tasks Section (Stacked to main node) - exclude post-it notes -->
		{#if hasTasks && template.id !== 'note'}
			<!-- Show task list in a stacked container -->
			<div
				class="relative w-full cursor-pointer rounded-b-lg border-t bg-borg-beige p-3"
				style="border-color: {borderColor};"
				onclick={handleTaskPillClick}
			>
				<div class="space-y-1">
					{#each tasks.slice(0, 3) as task}
						<div class="flex items-center gap-2 text-sm text-black">
							<div class="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-black"></div>
							<span class="truncate" title={task.title}>
								{task.title.length > 30 ? task.title.substring(0, 30) + '...' : task.title}
							</span>
						</div>
					{/each}
					{#if tasks.length > 3}
						<div class="mt-2 text-xs text-black/70">
							+{tasks.length - 3} more tasks
						</div>
					{/if}
				</div>
				<button
					onclick={(event) => {
						event.stopPropagation();
						handleTaskPillClick();
					}}
					class="absolute -right-2 -bottom-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-black bg-black text-white transition-colors hover:bg-borg-yellow hover:text-black"
				>
					<ListTodo class="h-3 w-3" />
				</button>
			</div>
		{/if}
	</div>
</div>
