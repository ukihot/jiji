<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let { class: extraClass = '', ...rest }: HTMLInputAttributes = $props();
</script>

<input
	class="border-border bg-background text-foreground focus:border-primary focus:ring-primary rounded-md px-2 py-1.5 text-sm {extraClass}"
	{...rest}
/>
