<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'outline' | 'danger-outline';

	const VARIANT_CLASS: Record<Variant, string> = {
		primary:
			'bg-primary text-primary-foreground flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium hover:opacity-90',
		outline:
			'border-border text-foreground hover:bg-background flex items-center gap-1 rounded-md border px-2 py-1 text-xs',
		'danger-outline':
			'border-danger/40 text-danger hover:bg-danger/10 flex items-center gap-1 rounded-md border px-2 py-1 text-xs',
	};

	let {
		variant = 'primary',
		type = 'button',
		class: extraClass = '',
		children,
		...rest
	}: HTMLButtonAttributes & { variant?: Variant; children: Snippet } = $props();
</script>

<button {type} class="{VARIANT_CLASS[variant]} {extraClass}" {...rest}>
	{@render children()}
</button>
