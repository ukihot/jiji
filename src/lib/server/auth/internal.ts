import type { Cookies } from '@sveltejs/kit';
import type { WorkspaceRole } from '$lib/core/workspace-role';

/**
 * design.md 8.4節: 内部ユーザー認証。
 *
 * 本実装（ID/パスワード + TOTP）はまだ作っていない。ここは開発用スタブで、
 * Cookieに選んだperson_idを保持するだけ。将来ここをTOTP検証に置き換える。
 * membershipの権限チェック自体（Shell側のcommands/queries）は本物のロジックを通す。
 */

const COOKIE_NAME = 'jiji_dev_person_id';

export interface CurrentPerson {
	id: string;
	name: string;
	/** design.md 8.5.2節: Magic Identity経由のexternalはメール無しで作成される */
	email: string | null;
	accountType: 'internal' | 'external';
	workspaceRole: WorkspaceRole | null;
	relayEnabled: boolean;
}

export function getCurrentPersonId(cookies: Cookies): string | null {
	return cookies.get(COOKIE_NAME) ?? null;
}

export function setCurrentPersonId(cookies: Cookies, personId: string): void {
	cookies.set(COOKIE_NAME, personId, { path: '/', httpOnly: true, sameSite: 'lax' });
}

export function clearCurrentPersonId(cookies: Cookies): void {
	cookies.delete(COOKIE_NAME, { path: '/' });
}
