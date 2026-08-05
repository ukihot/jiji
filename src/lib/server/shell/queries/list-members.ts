import { isMembershipActive } from '$lib/core/membership';
import type { SqliteDb } from '../../db';
import {
	listMembershipStateByScope,
	type MemberListRow,
} from '../repository/membership-repository';

export interface MemberView extends MemberListRow {
	isActive: boolean;
}

/**
 * design.md 8.3節: 失効はリクエスト毎に再評価する。ここで`now`と比較して`isActive`を都度算出する
 * （membership_state自体には有効/無効の状態を保存しない）。
 */
export async function listMembers(
	db: SqliteDb,
	scopeType: 'title' | 'timeline',
	scopeId: string,
	now: Date = new Date(),
): Promise<MemberView[]> {
	const rows = await listMembershipStateByScope(db, scopeType, scopeId);
	return rows
		.map((row) => ({
			...row,
			isActive: isMembershipActive({ expiresAt: row.expiresAt, revokedAt: row.revokedAt }, now),
		}))
		.sort((a, b) => a.personName.localeCompare(b.personName, 'ja'));
}
