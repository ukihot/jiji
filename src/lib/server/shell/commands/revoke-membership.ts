import {
	decideMembership,
	evolveMembership,
	type MembershipError,
	type MembershipEvent,
} from '$lib/core/membership';
import { projectMembershipState } from '$lib/core/projections/membership-state';
import type { SqliteDb } from '../../db';
import { appendEvent, getEventsByTarget } from '../repository/event-repository';
import {
	countActiveAdmins,
	getMembership,
	revokeMembershipRow,
	toStateRow,
	upsertMembershipState,
} from '../repository/membership-repository';

export interface RevokeMembershipInput {
	membershipId: string;
	revokedBy: string;
}

export type RevokeMembershipResult =
	| { ok: true }
	| { ok: false; error: MembershipError | { kind: 'membership_not_found' } };

export async function revokeMembership(
	db: SqliteDb,
	input: RevokeMembershipInput,
): Promise<RevokeMembershipResult> {
	const now = new Date();
	return db.transaction(async (tx): Promise<RevokeMembershipResult> => {
		const current = await getMembership(tx, input.membershipId);
		if (!current) return { ok: false, error: { kind: 'membership_not_found' } };

		const rawEvents = await getEventsByTarget(tx, 'membership', input.membershipId);
		const events = rawEvents.map((row) => row as unknown as MembershipEvent);
		const aggregate = evolveMembership(events);
		const targetIsCurrentlyAdmin = aggregate.permissionLevel === 'admin' && !aggregate.revoked;
		const activeAdminCountExcludingTarget = await countActiveAdmins(
			tx,
			current.scopeType,
			current.scopeId,
			now,
			input.membershipId,
		);

		const decision = decideMembership(
			{ type: 'RevokeMembership', membershipId: input.membershipId, revokedBy: input.revokedBy },
			{ now, activeAdminCountExcludingTarget, targetIsCurrentlyAdmin },
		);
		if (!decision.ok) return { ok: false, error: decision.error };

		const domainEvent = decision.events[0];
		await appendEvent(tx, 'membership', input.membershipId, domainEvent, now);
		await revokeMembershipRow(tx, input.membershipId, now, input.revokedBy);
		await upsertMembershipState(tx, projectMembershipState(domainEvent, toStateRow(current)));

		return { ok: true };
	});
}
