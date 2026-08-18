import { isShareLinkActive } from '$lib/core/share-link';
import type { SqliteDb } from '../../db';
import { hashShareToken } from '../../auth/share-token';
import { getPerson, type PersonRow } from '../repository/person-repository';
import { getShareLinkByTokenHash, type ShareLinkRow } from '../repository/share-link-repository';
import { getCut, getTimeline } from '../repository/timeline-repository';

export interface ResolvedShareLinkTargetCut {
	cutId: string;
	number: string;
	titleId: string;
	timelineId: string;
}

export interface ResolvedShareLink {
	link: ShareLinkRow;
	isActive: boolean;
	claimedPersonName: string | null;
	/** design.md 7.5節/8.5節: Cut Evolution Viewerへの導線を張るための、対象カットごとのTitle/Timeline解決結果 */
	targetCuts: ResolvedShareLinkTargetCut[];
}

/** design.md 8.5節 `/s/[token]`の着地ページ用。トークンから状態を解決する（読み取りのみ、claimはしない） */
export async function resolveShareLinkByToken(
	db: SqliteDb,
	token: string,
	now: Date = new Date(),
): Promise<ResolvedShareLink | null> {
	const link = await getShareLinkByTokenHash(db, hashShareToken(token));
	if (!link) return null;
	const claimedPerson = link.claimedPersonId ? await getPerson(db, link.claimedPersonId) : null;

	const targetCuts: ResolvedShareLinkTargetCut[] = [];
	for (const cutId of link.targetCutIds) {
		const cut = await getCut(db, cutId);
		if (!cut) continue;
		const timeline = await getTimeline(db, cut.timelineId);
		if (!timeline) continue;
		targetCuts.push({
			cutId,
			number: cut.number,
			titleId: timeline.titleId,
			timelineId: timeline.id,
		});
	}

	return {
		link,
		isActive: isShareLinkActive(link, now),
		claimedPersonName: claimedPerson?.name ?? null,
		targetCuts,
	};
}

/** design.md 8.4節のhooks.server.ts用: Cookieのshare_tokenから「今の自分」を引く */
export async function resolveClaimedPersonByToken(
	db: SqliteDb,
	token: string,
): Promise<PersonRow | null> {
	const link = await getShareLinkByTokenHash(db, hashShareToken(token));
	if (!link || !link.claimedPersonId) return null;
	return getPerson(db, link.claimedPersonId);
}
