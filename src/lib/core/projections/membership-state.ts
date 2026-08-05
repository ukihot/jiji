import type { MembershipEvent, MembershipScopeType, PermissionLevel } from '../membership';

/**
 * design.md 4.1節 membership_state のproject関数。
 * event 1件と現在の投影行から、次の投影行を計算する（同一トランザクションで書き戻す想定）。
 */

export interface MembershipStateRow {
	membershipId: string;
	personId: string;
	scopeType: MembershipScopeType;
	scopeId: string;
	permissionLevel: PermissionLevel;
	processScope: string[] | null;
	grantedAt: Date;
	expiresAt: Date | null;
	revokedAt: Date | null;
}

export function projectMembershipState(
	event: MembershipEvent,
	current: MembershipStateRow | null
): MembershipStateRow {
	switch (event.type) {
		case 'MembershipGranted':
			return {
				membershipId: event.payload.membershipId,
				personId: event.payload.personId,
				scopeType: event.payload.scopeType,
				scopeId: event.payload.scopeId,
				permissionLevel: event.payload.permissionLevel,
				processScope: event.payload.processScope,
				grantedAt: new Date(event.payload.grantedAt),
				expiresAt: event.payload.expiresAt ? new Date(event.payload.expiresAt) : null,
				revokedAt: null
			};

		case 'MembershipUpdated': {
			if (!current) {
				throw new Error('MembershipUpdated event has no prior membership_state projection');
			}
			return {
				...current,
				permissionLevel: event.payload.permissionLevel,
				processScope: event.payload.processScope
			};
		}

		case 'MembershipRevoked': {
			if (!current) {
				throw new Error('MembershipRevoked event has no prior membership_state projection');
			}
			return { ...current, revokedAt: new Date(event.payload.revokedAt) };
		}
	}
}
