import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { setShareTokenCookie } from '$lib/server/auth/share-token';
import { claimShareLink } from '$lib/server/shell/commands/claim-share-link';
import { resolveShareLinkByToken } from '$lib/server/shell/queries/resolve-share-link';

/** design.md 8.5節: 共有リンクの着地ページ。アカウント作成不要でここに到達できる */
export const load: PageServerLoad = async ({ params, locals }) => {
	return { resolved: await resolveShareLinkByToken(locals.db, params.token) };
};

export const actions: Actions = {
	claim: async ({ request, params, cookies, locals }) => {
		const formData = await request.formData();
		const name = formData.get('name');
		if (typeof name !== 'string' || name.trim().length === 0) {
			return fail(400, { message: '名前を入力してください' });
		}

		const result = await claimShareLink(locals.db, { token: params.token, name });
		if (!result.ok) {
			const message =
				result.error.kind === 'not_found'
					? 'リンクが見つかりません'
					: result.error.kind === 'link_inactive'
						? 'このリンクは期限切れ、または取り消されています'
						: result.error.kind === 'blank_name'
							? '名前を入力してください'
							: 'エラーが発生しました';
			return fail(400, { message });
		}

		// design.md 8.5.2節: 「認証はトークン、識別は名前」。以降はこのCookieで本人として扱う
		setShareTokenCookie(cookies, params.token, result.expiresAt);
		return { success: true };
	}
};
