import { and, eq, isNull, ne } from 'drizzle-orm';
import type { PermissionLevel } from '$lib/core/membership';
import type { SqliteQueryable } from '../../db';
import { membership, membershipState, person } from '../../db/schema';

// ---- membership（書き込み側。design.md 8.2節） ----

export interface MembershipRow {
	id: string;
	personId: string;
	scopeType: 'title' | 'timeline';
	scopeId: string;
	permissionLevel: PermissionLevel;
	processScope: string[] | null;
	grantedBy: string;
	grantedAt: Date;
	expiresAt: Date | null;
	revokedAt: Date | null;
	revokedBy: string | null;
}

export async function getMembership(
	db: SqliteQueryable,
	membershipId: string,
): Promise<MembershipRow | null> {
	const rows = await db.select().from(membership).where(eq(membership.id, membershipId));
	return rows[0] ?? null;
}

export async function insertMembership(db: SqliteQueryable, row: MembershipRow): Promise<void> {
	await db.insert(membership).values(row);
}

export async function updateMembershipPermission(
	db: SqliteQueryable,
	membershipId: string,
	permissionLevel: PermissionLevel,
	processScope: string[] | null,
): Promise<void> {
	await db
		.update(membership)
		.set({ permissionLevel, processScope })
		.where(eq(membership.id, membershipId));
}

export async function revokeMembershipRow(
	db: SqliteQueryable,
	membershipId: string,
	revokedAt: Date,
	revokedBy: string,
): Promise<void> {
	await db.update(membership).set({ revokedAt, revokedBy }).where(eq(membership.id, membershipId));
}

/** MembershipRow → MembershipStateRow（project関数への「現在の投影」入力を作るための変換） */
export function toStateRow(row: MembershipRow): MembershipStateRow {
	return {
		membershipId: row.id,
		personId: row.personId,
		scopeType: row.scopeType,
		scopeId: row.scopeId,
		permissionLevel: row.permissionLevel,
		processScope: row.processScope,
		grantedAt: row.grantedAt,
		expiresAt: row.expiresAt,
		revokedAt: row.revokedAt,
	};
}

// ---- membership_state（投影。design.md 4.1節/8.2節） ----

export interface MembershipStateRow {
	membershipId: string;
	personId: string;
	scopeType: 'title' | 'timeline';
	scopeId: string;
	permissionLevel: PermissionLevel;
	processScope: string[] | null;
	grantedAt: Date;
	expiresAt: Date | null;
	revokedAt: Date | null;
}

export async function upsertMembershipState(
	db: SqliteQueryable,
	row: MembershipStateRow,
): Promise<void> {
	const existing = await db
		.select({ membershipId: membershipState.membershipId })
		.from(membershipState)
		.where(eq(membershipState.membershipId, row.membershipId));
	if (existing.length > 0) {
		await db
			.update(membershipState)
			.set(row)
			.where(eq(membershipState.membershipId, row.membershipId));
	} else {
		await db.insert(membershipState).values(row);
	}
}

export interface MemberListRow extends MembershipStateRow {
	personName: string;
	personEmail: string | null;
}

/** design.md 8.6節のメンバー一覧画面用。personと結合して返す（失効済みも含めて全件、表示側でisActiveを判定する） */
export async function listMembershipStateByScope(
	db: SqliteQueryable,
	scopeType: 'title' | 'timeline',
	scopeId: string,
): Promise<MemberListRow[]> {
	return db
		.select({
			membershipId: membershipState.membershipId,
			personId: membershipState.personId,
			scopeType: membershipState.scopeType,
			scopeId: membershipState.scopeId,
			permissionLevel: membershipState.permissionLevel,
			processScope: membershipState.processScope,
			grantedAt: membershipState.grantedAt,
			expiresAt: membershipState.expiresAt,
			revokedAt: membershipState.revokedAt,
			personName: person.name,
			personEmail: person.email,
		})
		.from(membershipState)
		.innerJoin(person, eq(person.id, membershipState.personId))
		.where(and(eq(membershipState.scopeType, scopeType), eq(membershipState.scopeId, scopeId)));
}

/**
 * design.md 8.3節「最後のadminロックアウト防止」の判定材料。
 * あるTitleスコープで、指定membershipを除いた「現在有効なadmin」の人数を数える。
 */
export async function countActiveAdmins(
	db: SqliteQueryable,
	scopeType: 'title' | 'timeline',
	scopeId: string,
	now: Date,
	excludingMembershipId: string,
): Promise<number> {
	const rows = await db
		.select({ membershipId: membershipState.membershipId, expiresAt: membershipState.expiresAt })
		.from(membershipState)
		.where(
			and(
				eq(membershipState.scopeType, scopeType),
				eq(membershipState.scopeId, scopeId),
				eq(membershipState.permissionLevel, 'admin'),
				isNull(membershipState.revokedAt),
				ne(membershipState.membershipId, excludingMembershipId),
			),
		);
	return rows.filter((row) => row.expiresAt === null || row.expiresAt > now).length;
}
