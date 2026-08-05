<script lang="ts">
	import { AlertTriangle, ArrowLeft, KeyRound, LogIn } from 'lucide-svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<h1 class="flex items-center gap-2 text-2xl font-bold text-foreground">
	<KeyRound size={22} class="text-primary" aria-hidden="true" />
	開発用ログイン
</h1>
<p class="mt-1 text-sm text-muted">
	design.md 8.4節: ID/PW+TOTPの本実装の代わりに、内部ユーザーを選ぶだけの開発用スタブです。
</p>

{#if data.currentPerson}
	<p class="mt-4 text-sm text-foreground">現在ログイン中: <strong>{data.currentPerson.name}</strong></p>
{/if}

{#if form?.message}
	<p class="mt-4 flex items-center gap-1.5 text-sm text-danger">
		<AlertTriangle size={16} aria-hidden="true" />
		{form.message}
	</p>
{/if}

{#if data.persons.length === 0}
	<p class="mt-4 text-sm text-muted">内部ユーザーがまだいません。先にseedスクリプトなどで作成してください。</p>
{:else}
	<form method="POST" class="mt-4 flex items-end gap-2">
		<select
			name="personId"
			required
			class="rounded-md border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:ring-primary"
		>
			<option value="" selected disabled>選択してください</option>
			{#each data.persons as person (person.id)}
				<option value={person.id}>{person.name}{person.email ? `（${person.email}）` : ''}</option>
			{/each}
		</select>
		<button
			type="submit"
			class="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
		>
			<LogIn size={16} aria-hidden="true" />
			ログイン
		</button>
	</form>
{/if}

<p class="mt-6">
	<a href="/" class="flex w-fit items-center gap-1 text-sm text-primary no-underline hover:underline">
		<ArrowLeft size={14} aria-hidden="true" />
		トップへ戻る
	</a>
</p>
