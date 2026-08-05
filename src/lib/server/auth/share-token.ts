import type { Cookies } from '@sveltejs/kit';
import { createHash, randomBytes } from 'node:crypto';

/**
 * design.md 8.5.2節: 「認証はトークン、識別は名前」。
 * トークン本体はURL・Cookieに載る秘密情報で、DBにはハッシュだけを保存する
 * （パスワードリセットトークンと同じ考え方。漏洩してもDBダンプからは復元できない）。
 */

const COOKIE_NAME = 'jiji_share_token';

export function generateShareToken(): string {
	return randomBytes(32).toString('base64url');
}

export function hashShareToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function getShareTokenFromCookie(cookies: Cookies): string | null {
	return cookies.get(COOKIE_NAME) ?? null;
}

export function setShareTokenCookie(cookies: Cookies, token: string, expiresAt: Date): void {
	cookies.set(COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		expires: expiresAt,
	});
}
