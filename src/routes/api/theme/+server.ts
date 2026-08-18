import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	BURNDOWN_STYLE_COOKIE,
	MODE_COOKIE,
	THEME_COOKIE,
	isBurndownStyle,
	isThemeId,
	isThemeMode,
} from '$lib/theme';

/** ThemeSwitcher.svelteから叩く、テーマ選択をCookieに保存するだけの小さなエンドポイント */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const body: unknown = await request.json();
	const theme = body && typeof body === 'object' && 'theme' in body ? body.theme : undefined;
	const mode = body && typeof body === 'object' && 'mode' in body ? body.mode : undefined;
	const burndownStyle =
		body && typeof body === 'object' && 'burndownStyle' in body ? body.burndownStyle : undefined;
	const oneYear = { path: '/', maxAge: 60 * 60 * 24 * 365 } as const;

	if (typeof theme === 'string' && isThemeId(theme)) {
		cookies.set(THEME_COOKIE, theme, oneYear);
	}
	if (typeof mode === 'string' && isThemeMode(mode)) {
		cookies.set(MODE_COOKIE, mode, oneYear);
	}
	if (typeof burndownStyle === 'string' && isBurndownStyle(burndownStyle)) {
		cookies.set(BURNDOWN_STYLE_COOKIE, burndownStyle, oneYear);
	}

	return json({ ok: true });
};
