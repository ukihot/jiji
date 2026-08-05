<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { LucideIcon } from '@lucide/svelte';

	let {
		icon: Icon,
		srLabel,
		value,
		onchange,
		children,
	}: {
		icon: LucideIcon;
		srLabel: string;
		value: string;
		onchange: (event: Event & { currentTarget: HTMLSelectElement }) => void;
		children: Snippet;
	} = $props();
</script>

<label class="text-muted flex items-center gap-1.5 text-sm">
	<Icon size={16} aria-hidden="true" />
	<span class="sr-only">{srLabel}</span>
	<select
		{value}
		{onchange}
		class="border-border bg-surface text-foreground rounded-md py-1 pr-7 pl-2 text-sm"
	>
		{@render children()}
	</select>
</label>
