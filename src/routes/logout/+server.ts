import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearCurrentPersonId } from '$lib/server/auth/internal';
import { clearShareTokenCookie } from '$lib/server/auth/share-token';

/** ヘッダーのUserMenuから呼ばれる。内部ユーザー・Magic Identity両方のCookieを消す */
export const POST: RequestHandler = ({ cookies }) => {
	clearCurrentPersonId(cookies);
	clearShareTokenCookie(cookies);
	redirect(303, '/');
};
