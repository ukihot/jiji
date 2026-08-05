<script lang="ts">
	import Languages from '@lucide/svelte/icons/languages';
	import * as m from '$lib/paraglide/messages';
	import { getLocale, locales, setLocale, type Locale } from '$lib/paraglide/runtime';
	import IconSelect from './IconSelect.svelte';

	/** ロケールコードだけでは分かりにくいので、対応表に無いものだけコードのまま出す */
	const LOCALE_NAMES: Partial<Record<Locale, string>> = {
		ja: '日本語',
		en: 'English',
	};

	function onChange(event: Event & { currentTarget: HTMLSelectElement }) {
		// design.md/CLAUDE.md: strategy は cookie ベース（url プレフィックスは使わない）なので、
		// href 遷移ではなく setLocale() で Cookie を切り替えてリロードする。
		setLocale(event.currentTarget.value as Locale);
	}
</script>

<IconSelect
	icon={Languages}
	srLabel={m.language_label_sr()}
	value={getLocale()}
	onchange={onChange}
>
	{#each locales as locale (locale)}
		<option value={locale}>{LOCALE_NAMES[locale] ?? locale.toUpperCase()}</option>
	{/each}
</IconSelect>
