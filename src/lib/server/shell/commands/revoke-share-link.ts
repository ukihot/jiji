import {
	decideShareLink,
	evolveShareLink,
	type ShareLinkError,
	type ShareLinkEvent,
} from '$lib/core/share-link';
import type { SqliteDb } from '../../db';
import { appendEvent, getEventsByTarget } from '../repository/event-repository';
import { getShareLink, setRevoked } from '../repository/share-link-repository';

export interface RevokeShareLinkInput {
	shareLinkId: string;
	revokedBy: string;
}

export type RevokeShareLinkResult =
	| { ok: true }
	| { ok: false; error: ShareLinkError | { kind: 'not_found' } };

export async function revokeShareLink(
	db: SqliteDb,
	input: RevokeShareLinkInput,
): Promise<RevokeShareLinkResult> {
	const now = new Date();
	return db.transaction(async (tx): Promise<RevokeShareLinkResult> => {
		const link = await getShareLink(tx, input.shareLinkId);
		if (!link) return { ok: false, error: { kind: 'not_found' } };

		const rawEvents = await getEventsByTarget(tx, 'share_link', input.shareLinkId);
		const events = rawEvents.map((row) => row as unknown as ShareLinkEvent);
		const aggregate = evolveShareLink(events);

		const decision = decideShareLink(
			{ type: 'RevokeShareLink', shareLinkId: input.shareLinkId, revokedBy: input.revokedBy },
			{
				now,
				isActive: true,
				alreadyClaimedPersonId: aggregate.claimedPersonId,
				alreadyRevoked: aggregate.revoked,
			},
		);
		if (!decision.ok) return { ok: false, error: decision.error };

		await appendEvent(tx, 'share_link', input.shareLinkId, decision.events[0], now);
		await setRevoked(tx, input.shareLinkId, now);

		return { ok: true };
	});
}
