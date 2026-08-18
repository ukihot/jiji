/**
 * 9テーマ × light/dark = 18通りのテーマ切り替え。
 * サーバー（hooks.server.ts、Cookie読み取り→SSR時に%app.theme%/%app.mode%へ注入）と
 * クライアント（ThemeSwitcher.svelte）の両方から参照する定義の単一の情報源。
 */

export const THEMES = [
	{ id: 'rurizora', name: '瑠璃空' },
	{ id: 'gekkako', name: '月下香' },
	{ id: 'yuugasumi', name: '夕霞' },
	{ id: 'yozakura', name: '夜桜' },
	{ id: 'wakakage', name: '若草影' },
	{ id: 'fukamidori', name: '深緑木立' },
	{ id: 'hoshizukiyo', name: '星月夜' },
	{ id: 'beniusurai', name: '紅薄氷' },
	{ id: 'asaginami', name: '浅葱波' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];
export type ThemeMode = 'light' | 'dark';
export type BurndownStyle = 'standard' | 'rough';

export const DEFAULT_THEME: ThemeId = 'rurizora';
export const DEFAULT_MODE: ThemeMode = 'light';

const THEME_IDS: readonly string[] = THEMES.map((t) => t.id);

export function isThemeId(value: string | undefined | null): value is ThemeId {
	return !!value && THEME_IDS.includes(value);
}

export function isThemeMode(value: string | undefined | null): value is ThemeMode {
	return value === 'light' || value === 'dark';
}

export const THEME_COOKIE = 'jiji_theme';
export const MODE_COOKIE = 'jiji_mode';
export const BURNDOWN_STYLE_COOKIE = 'jiji_burndown_style';

export function isBurndownStyle(value: string | undefined | null): value is BurndownStyle {
	return value === 'standard' || value === 'rough';
}
