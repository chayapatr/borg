<script lang="ts">
	import type { TemplateField } from '../../templates';
	import FieldFactory from './FieldFactory.svelte';

	let {
		field,
		value = $bindable(),
		readonly = false,
		mode = 'display',
		nodeData = undefined,
		countdownOnly = false,
		isProjectTitle = false
	} = $props<{
		field: TemplateField;
		value: any;
		readonly?: boolean;
		mode?: 'display' | 'edit';
		nodeData?: any;
		countdownOnly?: boolean;
		isProjectTitle?: boolean;
	}>();
</script>

<FieldFactory {field} bind:value {readonly} {mode} {nodeData} {countdownOnly} {isProjectTitle} />
