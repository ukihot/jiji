<script lang="ts">
	import KeyRound from '@lucide/svelte/icons/key-round';
	import LogIn from '@lucide/svelte/icons/log-in';
	import * as m from '$lib/paraglide/messages';
	import BackLink from '$lib/components/BackLink.svelte';
	import Button from '$lib/components/Button.svelte';
	import ErrorNotice from '$lib/components/ErrorNotice.svelte';
	import FormSelect from '$lib/components/FormSelect.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<h1 class="text-foreground flex items-center gap-2 text-2xl font-bold">
	<KeyRound size={22} class="text-primary" aria-hidden="true" />
	{m.devlogin_heading()}
</h1>
<p class="text-muted mt-1 text-sm">
	{m.devlogin_hint()}
</p>

{#if data.currentPerson}
	<p class="text-foreground mt-4 text-sm">
		{m.devlogin_current_user_prefix()} <strong>{data.currentPerson.name}</strong>
	</p>
{/if}

{#if form?.message}
	<ErrorNotice message={form.message} class="mt-4" />
{/if}

{#if data.persons.length === 0}
	<p class="text-muted mt-4 text-sm">
		{m.devlogin_no_users()}
	</p>
{:else}
	<form method="POST" class="mt-4 flex items-end gap-2">
		<FormSelect name="personId" required>
			<option value="" selected disabled>{m.select_placeholder()}</option>
			{#each data.persons as person (person.id)}
				<option value={person.id}>{person.name}{person.email ? `（${person.email}）` : ''}</option>
			{/each}
		</FormSelect>
		<Button type="submit">
			<LogIn size={16} aria-hidden="true" />
			{m.devlogin_submit()}
		</Button>
	</form>
{/if}

<p class="mt-6">
	<BackLink href="/">{m.nav_back_home()}</BackLink>
</p>
