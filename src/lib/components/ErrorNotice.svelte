<script lang="ts">
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import type { LucideIcon } from '@lucide/svelte';

	let {
		message,
		icon: Icon = AlertTriangle,
		class: extraClass = '',
	}: { message: string; icon?: LucideIcon; class?: string } = $props();
</script>

<p class="text-danger flex items-center gap-1.5 text-sm {extraClass}">
	<Icon size={16} aria-hidden="true" />
	{message}
</p>
