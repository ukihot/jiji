<script lang="ts">
	import { Moon, Palette, Sun } from 'lucide-svelte';
	import { THEMES, type ThemeId, type ThemeMode } from '$lib/theme';

	let { theme, mode }: { theme: ThemeId; mode: ThemeMode } = $props();

	// サーバーから来た初期値をローカル状態の種にするだけで、以降はこのコンポーネントが
	// 自分でテーマを管理する（選択の度にサーバー往復・レイアウト再読み込みを待たせないため）。
	// svelte-ignore state_referenced_locally
	let currentTheme = $state(theme);
	// svelte-ignore state_referenced_locally
	let currentMode = $state(mode);

	function apply(nextTheme: ThemeId, nextMode: ThemeMode) {
		document.documentElement.dataset.theme = nextTheme;
		document.documentElement.dataset.mode = nextMode;
		// Cookieへの保存は failしても致命的ではないのでawaitしない（UIは即座に反映済み）
		void fetch('/api/theme', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ theme: nextTheme, mode: nextMode })
		});
	}

	function onThemeChange(event: Event & { currentTarget: HTMLSelectElement }) {
		currentTheme = event.currentTarget.value as ThemeId;
		apply(currentTheme, currentMode);
	}

	function toggleMode() {
		currentMode = currentMode === 'light' ? 'dark' : 'light';
		apply(currentTheme, currentMode);
	}
</script>

<div class="flex items-center gap-2">
	<button
		type="button"
		onclick={toggleMode}
		class="rounded-md border border-border p-1.5 text-foreground transition-colors hover:bg-surface"
		aria-label={currentMode === 'light' ? 'ダークモードに切り替え' : 'ライトモードに切り替え'}
		title={currentMode === 'light' ? 'ダークモードに切り替え' : 'ライトモードに切り替え'}
	>
		{#if currentMode === 'light'}
			<Sun size={16} />
		{:else}
			<Moon size={16} />
		{/if}
	</button>

	<label class="flex items-center gap-1.5 text-sm text-muted">
		<Palette size={16} aria-hidden="true" />
		<span class="sr-only">テーマ</span>
		<select
			value={currentTheme}
			onchange={onThemeChange}
			class="rounded-md border-border bg-surface py-1 pr-7 pl-2 text-sm text-foreground"
		>
			{#each THEMES as t (t.id)}
				<option value={t.id}>{t.name}</option>
			{/each}
		</select>
	</label>
</div>
