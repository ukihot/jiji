import { isShareLinkActive } from '$lib/core/share-link';
import type { SqliteDb } from '../../db';
import { listShareLinks, type ShareLinkRow } from '../repository/share-link-repository';

export interface ShareLinkView extends ShareLinkRow {
	isActive: boolean;
}

/** design.md 8.5.5節。あるTimelineの帯に出ているCutのどれかを対象に含むリンクだけを見せる */
export async function listShareLinksForCuts(
	db: SqliteDb,
	cutIds: readonly string[],
	now: Date = new Date()
): Promise<ShareLinkView[]> {
	const cutIdSet = new Set(cutIds);
	const links = await listShareLinks(db);
	return links
		.filter((link) => link.targetCutIds.some((id) => cutIdSet.has(id)))
		.map((link) => ({ ...link, isActive: isShareLinkActive(link, now) }))
		.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
