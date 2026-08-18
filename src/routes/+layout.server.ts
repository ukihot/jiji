import type { LayoutServerLoad } from './$types';
import {
	DEFAULT_MODE,
	DEFAULT_THEME,
	BURNDOWN_STYLE_COOKIE,
	MODE_COOKIE,
	THEME_COOKIE,
	isThemeId,
	isThemeMode,
	isBurndownStyle,
} from '$lib/theme';

/** ヘッダー（全ページ共通）に必要な最小限のデータ */
export const load: LayoutServerLoad = ({ cookies, locals }) => {
	const themeCookie = cookies.get(THEME_COOKIE);
	const modeCookie = cookies.get(MODE_COOKIE);
	const burndownStyleCookie = cookies.get(BURNDOWN_STYLE_COOKIE);

	return {
		currentPerson: locals.currentPerson,
		theme: isThemeId(themeCookie) ? themeCookie : DEFAULT_THEME,
		mode: isThemeMode(modeCookie) ? modeCookie : DEFAULT_MODE,
		burndownStyle: isBurndownStyle(burndownStyleCookie) ? burndownStyleCookie : 'standard',
	};
};
