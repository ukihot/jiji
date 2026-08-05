import { eq } from 'drizzle-orm';
import type { SharePermissionLevel } from '$lib/core/share-link';
import type { SqliteQueryable } from '../../db';
import { shareLink } from '../../db/schema';

export interface ShareLinkRow {
	id: string;
	tokenHash: string;
	targetCutIds: string[];
	permissionLevel: SharePermissionLevel;
	claimedPersonId: string | null;
	expiresAt: Date;
	createdBy: string;
	createdAt: Date;
	revokedAt: Date | null;
}

export async function insertShareLink(db: SqliteQueryable, row: ShareLinkRow): Promise<void> {
	await db.insert(shareLink).values(row);
}

export async function getShareLink(
	db: SqliteQueryable,
	shareLinkId: string,
): Promise<ShareLinkRow | null> {
	const rows = await db.select().from(shareLink).where(eq(shareLink.id, shareLinkId));
	return rows[0] ?? null;
}

export async function getShareLinkByTokenHash(
	db: SqliteQueryable,
	tokenHash: string,
): Promise<ShareLinkRow | null> {
	const rows = await db.select().from(shareLink).where(eq(shareLink.tokenHash, tokenHash));
	return rows[0] ?? null;
}

/** 全件返す。「あるTimelineに関わるリンクだけ」の絞り込みはtargetCutIdsを見てクエリ層で行う（8.5.5節） */
export async function listShareLinks(db: SqliteQueryable): Promise<ShareLinkRow[]> {
	return db.select().from(shareLink);
}

export async function setClaimedPerson(
	db: SqliteQueryable,
	shareLinkId: string,
	personId: string,
): Promise<void> {
	await db
		.update(shareLink)
		.set({ claimedPersonId: personId })
		.where(eq(shareLink.id, shareLinkId));
}

export async function setRevoked(
	db: SqliteQueryable,
	shareLinkId: string,
	revokedAt: Date,
): Promise<void> {
	await db.update(shareLink).set({ revokedAt }).where(eq(shareLink.id, shareLinkId));
}
