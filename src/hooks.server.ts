import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { getDb, type SqliteDb } from '$lib/server/db';
import { getCurrentPersonId } from '$lib/server/auth/internal';
import { getShareTokenFromCookie } from '$lib/server/auth/share-token';
import { getPerson } from '$lib/server/shell/repository/person-repository';
import { resolveClaimedPersonByToken } from '$lib/server/shell/queries/resolve-share-link';
import {
	DEFAULT_MODE,
	DEFAULT_THEME,
	MODE_COOKIE,
	THEME_COOKIE,
	isThemeId,
	isThemeMode,
} from '$lib/theme';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale)),
		});
	});

/**
 * 9テーマ×light/dark=18通りの切り替え。Cookieから読み、SSR時点で%app.theme%/%app.mode%を
 * 埋め込む（クライアントJS実行前に確定させ、テーマ切り替わり時のチラつき＝FOUCを避ける）。
 */
const handleTheme: Handle = ({ event, resolve }) => {
	const themeCookie = event.cookies.get(THEME_COOKIE);
	const modeCookie = event.cookies.get(MODE_COOKIE);
	const theme = isThemeId(themeCookie) ? themeCookie : DEFAULT_THEME;
	const mode = isThemeMode(modeCookie) ? modeCookie : DEFAULT_MODE;

	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace('%app.theme%', theme).replace('%app.mode%', mode),
	});
};

/**
 * design.md 8章: どのリクエストでも「今の自分は誰か」をlocalsに載せる。
 * 優先順位は (1) 開発用スタブログイン（内部ユーザー） → (2) Magic Identityの共有リンクトークン（外部ユーザー）。
 * どちらのCookieも無ければ未ログイン扱い（currentPerson = null）。
 */
const handleSession: Handle = async ({ event, resolve }) => {
	// 今回はSQLiteパスのみ実装している（lib/server/db/index.tsのコメント参照）。D1接続時にここを直す。
	const db = (await getDb(event.platform)) as SqliteDb;
	event.locals.db = db;

	const devPersonId = getCurrentPersonId(event.cookies);
	if (devPersonId) {
		event.locals.currentPerson = await getPerson(db, devPersonId);
		return resolve(event);
	}

	const shareToken = getShareTokenFromCookie(event.cookies);
	if (shareToken) {
		event.locals.currentPerson = await resolveClaimedPersonByToken(db, shareToken);
		return resolve(event);
	}

	event.locals.currentPerson = null;
	return resolve(event);
};

export const handle: Handle = sequence(handleSession, handleTheme, handleParaglide);
