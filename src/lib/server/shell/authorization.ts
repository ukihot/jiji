import { isMembershipActive, type PermissionLevel } from '$lib/core/membership';
import type { SqliteDb } from '../db';
import { listMembershipStateByScope } from './repository/membership-repository';

const RANK: Record<PermissionLevel, number> = { viewer: 0, contributor: 1, reviewer: 2, admin: 3 };

export function meetsLevel(level: PermissionLevel, min: PermissionLevel): boolean {
	return RANK[level] >= RANK[min];
}

/**
 * design.md 8.2節: メンバー管理・共有リンク発行のような操作は、呼び出し元のmembershipが
 * 十分な権限を持つかをルートハンドラ（+page.server.ts）側で確認してから行う。
 * Title/Timeline両スコープのうち、現在有効な最も高い権限で判定する。
 */
export async function hasAtLeast(
	db: SqliteDb,
	personId: string,
	titleId: string,
	min: PermissionLevel,
	now: Date = new Date(),
	timelineId?: string
): Promise<boolean> {
	const scopes: Array<{ scopeType: 'title' | 'timeline'; scopeId: string }> = [
		{ scopeType: 'title', scopeId: titleId }
	];
	if (timelineId) scopes.push({ scopeType: 'timeline', scopeId: timelineId });

	for (const scope of scopes) {
		const rows = await listMembershipStateByScope(db, scope.scopeType, scope.scopeId);
		const matched = rows.some(
			(row) =>
				row.personId === personId &&
				meetsLevel(row.permissionLevel, min) &&
				isMembershipActive({ expiresAt: row.expiresAt, revokedAt: row.revokedAt }, now)
		);
		if (matched) return true;
	}
	return false;
}
