import { isShareLinkActive } from '$lib/core/share-link';
import type { SqliteDb } from '../../db';
import { hashShareToken } from '../../auth/share-token';
import { getPerson, type PersonRow } from '../repository/person-repository';
import { getShareLinkByTokenHash, type ShareLinkRow } from '../repository/share-link-repository';

export interface ResolvedShareLink {
	link: ShareLinkRow;
	isActive: boolean;
	claimedPersonName: string | null;
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
	return {
		link,
		isActive: isShareLinkActive(link, now),
		claimedPersonName: claimedPerson?.name ?? null,
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
