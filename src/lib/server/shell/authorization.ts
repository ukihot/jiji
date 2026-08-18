import { isShareLinkActive } from '$lib/core/share-link';
import type { SqliteDb } from '../db';
import { listShareLinks } from './repository/share-link-repository';

/**
 * design.md 8.5節 Magic Identity: 共有リンク参加者が、そのcutを対象にした有効な
 * contributorリンクを持っているか。ワークスペースロールを持つ内部ユーザーの認可は
 * CoreのcanWorkspaceRoleで完結し、この関数は外部参加者の例外だけを扱う。
 */
export async function hasShareLinkContributorAccess(
	db: SqliteDb,
	personId: string,
	cutId: string,
	now: Date = new Date(),
): Promise<boolean> {
	return hasShareLinkAccess(db, personId, cutId, now, 'contributor');
}

export async function hasShareLinkAccess(
	db: SqliteDb,
	personId: string,
	cutId: string,
	now: Date = new Date(),
	minimum: 'viewer' | 'contributor' = 'viewer',
): Promise<boolean> {
	const links = await listShareLinks(db);
	return links.some(
		(link) =>
			link.claimedPersonId === personId &&
			(link.permissionLevel === 'contributor' || minimum === 'viewer') &&
			link.targetCutIds.includes(cutId) &&
			isShareLinkActive(link, now),
	);
}
