import {
	decideMembership,
	evolveMembership,
	type MembershipError,
	type MembershipEvent,
	type PermissionLevel,
} from '$lib/core/membership';
import { projectMembershipState } from '$lib/core/projections/membership-state';
import type { SqliteDb } from '../../db';
import { appendEvent, getEventsByTarget } from '../repository/event-repository';
import {
	countActiveAdmins,
	getMembership,
	toStateRow,
	updateMembershipPermission,
	upsertMembershipState,
} from '../repository/membership-repository';

export interface UpdateMembershipInput {
	membershipId: string;
	permissionLevel: PermissionLevel;
	processScope: string[] | null;
}

export type UpdateMembershipResult =
	| { ok: true }
	| { ok: false; error: MembershipError | { kind: 'membership_not_found' } };

/** design.md 8.3節「最後のadminロックアウト防止」を通す権限変更コマンド */
export async function updateMembership(
	db: SqliteDb,
	input: UpdateMembershipInput,
): Promise<UpdateMembershipResult> {
	const now = new Date();
	return db.transaction(async (tx): Promise<UpdateMembershipResult> => {
		const current = await getMembership(tx, input.membershipId);
		if (!current) return { ok: false, error: { kind: 'membership_not_found' } };

		// design.md 2.2節: このmembership自身のイベント列をevolveして「今admin権限を持っているか」を判定する
		const rawEvents = await getEventsByTarget(tx, 'membership', input.membershipId);
		const events = rawEvents.map((row) => row as unknown as MembershipEvent);
		const aggregate = evolveMembership(events);
		const targetIsCurrentlyAdmin = aggregate.permissionLevel === 'admin' && !aggregate.revoked;
		// Title横断の集計はmembership_state投影から数える（8.3節）
		const activeAdminCountExcludingTarget = await countActiveAdmins(
			tx,
			current.scopeType,
			current.scopeId,
			now,
			input.membershipId,
		);

		const decision = decideMembership(
			{
				type: 'UpdateMembership',
				membershipId: input.membershipId,
				permissionLevel: input.permissionLevel,
				processScope: input.processScope,
			},
			{ now, activeAdminCountExcludingTarget, targetIsCurrentlyAdmin },
		);
		if (!decision.ok) return { ok: false, error: decision.error };

		const domainEvent = decision.events[0];
		await appendEvent(tx, 'membership', input.membershipId, domainEvent, now);
		await updateMembershipPermission(
			tx,
			input.membershipId,
			input.permissionLevel,
			input.processScope,
		);
		await upsertMembershipState(tx, projectMembershipState(domainEvent, toStateRow(current)));

		return { ok: true };
	});
}
