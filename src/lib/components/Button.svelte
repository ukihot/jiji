<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'outline' | 'danger-outline';

	const VARIANT_CLASS: Record<Variant, string> = {
		primary:
			'bg-primary text-primary-foreground flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold shadow-[0_6px_16px_color-mix(in_oklch,var(--color-primary)_24%,transparent)] transition hover:-translate-y-px hover:opacity-90',
		outline:
			'border-border text-foreground hover:bg-background flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition hover:-translate-y-px',
		'danger-outline':
			'border-danger/40 text-danger hover:bg-danger/10 flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition hover:-translate-y-px',
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
