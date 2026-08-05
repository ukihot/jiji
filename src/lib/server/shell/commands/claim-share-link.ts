import { decideShareLink, evolveShareLink, isShareLinkActive, type ShareLinkError, type ShareLinkEvent } from '$lib/core/share-link';
import { hashShareToken } from '../../auth/share-token';
import type { SqliteDb } from '../../db';
import { appendEvent, getEventsByTarget } from '../repository/event-repository';
import { insertPerson } from '../repository/person-repository';
import { getShareLinkByTokenHash, setClaimedPerson } from '../repository/share-link-repository';

export interface ClaimShareLinkInput {
	token: string;
	name: string;
}

export type ClaimShareLinkResult =
	| { ok: true; personId: string; alreadyClaimed: boolean; expiresAt: Date }
	| { ok: false; error: ShareLinkError | { kind: 'not_found' } };

/** design.md 8.5.2節 Magic Identity: 名前入力だけでexternal personを作り、share_linkに紐付ける */
export async function claimShareLink(db: SqliteDb, input: ClaimShareLinkInput): Promise<ClaimShareLinkResult> {
	const now = new Date();
	const tokenHash = hashShareToken(input.token);

	return db.transaction(async (tx): Promise<ClaimShareLinkResult> => {
		const link = await getShareLinkByTokenHash(tx, tokenHash);
		if (!link) return { ok: false, error: { kind: 'not_found' } };

		// 既にclaim済みなら新しいイベントは起こさず、その人物をそのまま返す（同一トークン＝同一人物）
		if (link.claimedPersonId !== null) {
			return { ok: true, personId: link.claimedPersonId, alreadyClaimed: true, expiresAt: link.expiresAt };
		}

		const rawEvents = await getEventsByTarget(tx, 'share_link', link.id);
		const events = rawEvents.map((row) => row as unknown as ShareLinkEvent);
		const aggregate = evolveShareLink(events);
		const personId = crypto.randomUUID();

		const decision = decideShareLink(
			{ type: 'ClaimShareLink', shareLinkId: link.id, personId, name: input.name },
			{
				now,
				isActive: isShareLinkActive(link, now),
				alreadyClaimedPersonId: aggregate.claimedPersonId,
				alreadyRevoked: aggregate.revoked
			}
		);
		if (!decision.ok) return { ok: false, error: decision.error };

		await appendEvent(tx, 'share_link', link.id, decision.events[0], now);
		await insertPerson(tx, { id: personId, name: input.name, email: null, accountType: 'external' });
		await setClaimedPerson(tx, link.id, personId);

		return { ok: true, personId, alreadyClaimed: false, expiresAt: link.expiresAt };
	});
}
