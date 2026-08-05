import { decideMembership, type MembershipError, type PermissionLevel } from '$lib/core/membership';
import { projectMembershipState } from '$lib/core/projections/membership-state';
import type { SqliteDb, SqliteQueryable } from '../../db';
import { appendEvent } from '../repository/event-repository';
import { insertMembership, upsertMembershipState } from '../repository/membership-repository';
import { getPerson } from '../repository/person-repository';

export interface GrantMembershipInput {
	personId: string;
	scopeType: 'title' | 'timeline';
	scopeId: string;
	permissionLevel: PermissionLevel;
	processScope: string[] | null;
	grantedBy: string;
	expiresAt: Date | null;
}

export type GrantMembershipResult =
	| { ok: true; membershipId: string }
	| { ok: false; error: MembershipError | { kind: 'person_not_found' } };

/**
 * トランザクション内部で使う実体。create-title.tsが「Title作成者に自動でadmin付与」する際にも
 * 同じトランザクションから呼ぶ（Titleを作った瞬間、そのTitleにadminが0人という
 * 最後のadminロックアウト状態を作らないため）。
 */
export async function grantMembershipInTx(
	tx: SqliteQueryable,
	input: GrantMembershipInput,
	now: Date
): Promise<GrantMembershipResult> {
	const membershipId = crypto.randomUUID();

	const targetPerson = await getPerson(tx, input.personId);
	if (!targetPerson) return { ok: false, error: { kind: 'person_not_found' } };

	const decision = decideMembership(
		{
			type: 'GrantMembership',
			membershipId,
			personId: input.personId,
			personAccountType: targetPerson.accountType,
			scopeType: input.scopeType,
			scopeId: input.scopeId,
			permissionLevel: input.permissionLevel,
			processScope: input.processScope,
			grantedBy: input.grantedBy,
			expiresAt: input.expiresAt
		},
		// Grant時はロックアウト判定を使わないのでダミー値でよい
		{ now, activeAdminCountExcludingTarget: 0, targetIsCurrentlyAdmin: false }
	);
	if (!decision.ok) return { ok: false, error: decision.error };

	const domainEvent = decision.events[0];
	await appendEvent(tx, 'membership', membershipId, domainEvent, now);
	await insertMembership(tx, {
		id: membershipId,
		personId: input.personId,
		scopeType: input.scopeType,
		scopeId: input.scopeId,
		permissionLevel: input.permissionLevel,
		processScope: input.processScope,
		grantedBy: input.grantedBy,
		grantedAt: now,
		expiresAt: input.expiresAt,
		revokedAt: null,
		revokedBy: null
	});
	await upsertMembershipState(tx, projectMembershipState(domainEvent, null));

	return { ok: true, membershipId };
}

/** design.md 8章: Googleスプレッドシート共有を踏襲したmembership付与 */
export async function grantMembership(db: SqliteDb, input: GrantMembershipInput): Promise<GrantMembershipResult> {
	const now = new Date();
	return db.transaction((tx) => grantMembershipInTx(tx, input, now));
}
