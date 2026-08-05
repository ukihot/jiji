/**
 * design.md 8章: ユーザー管理（Googleスプレッドシートの共有を踏襲したmembership）のCore。
 */

export type PermissionLevel = 'viewer' | 'contributor' | 'reviewer' | 'admin';
export type MembershipScopeType = 'title' | 'timeline';

export type MembershipEvent =
	| {
			type: 'MembershipGranted';
			payload: {
				membershipId: string;
				personId: string;
				scopeType: MembershipScopeType;
				scopeId: string;
				permissionLevel: PermissionLevel;
				processScope: string[] | null;
				grantedBy: string;
				grantedAt: string; // ISO
				expiresAt: string | null; // ISO
			};
	  }
	| {
			type: 'MembershipUpdated';
			payload: {
				membershipId: string;
				permissionLevel: PermissionLevel;
				processScope: string[] | null;
			};
	  }
	| {
			type: 'MembershipRevoked';
			payload: { membershipId: string; revokedBy: string; revokedAt: string };
	  };

export type MembershipCommand =
	| {
			type: 'GrantMembership';
			membershipId: string;
			personId: string;
			personAccountType: 'internal' | 'external';
			scopeType: MembershipScopeType;
			scopeId: string;
			permissionLevel: PermissionLevel;
			processScope: string[] | null;
			grantedBy: string;
			expiresAt: Date | null;
	  }
	| {
			type: 'UpdateMembership';
			membershipId: string;
			permissionLevel: PermissionLevel;
			processScope: string[] | null;
	  }
	| { type: 'RevokeMembership'; membershipId: string; revokedBy: string };

export type MembershipError =
	/** design.md 8.3節: scope_type=timeline または person.account_type=external では有効期限が必須 */
	| { kind: 'expiry_required' }
	/** design.md 8.3節: あるTitleでadmin権限を持つ有効なmembershipを0人にする操作は拒否 */
	| { kind: 'last_admin_lockout' };

export type MembershipDecideResult =
	| { ok: true; events: MembershipEvent[] }
	| { ok: false; error: MembershipError };

/** 1件のmembershipの、その時点までのイベントを畳み込んだ状態 */
export interface MembershipAggregateState {
	permissionLevel: PermissionLevel | null; // null = まだGrantされていない
	revoked: boolean;
}

export function evolveMembership(events: readonly MembershipEvent[]): MembershipAggregateState {
	let state: MembershipAggregateState = { permissionLevel: null, revoked: false };
	for (const event of events) {
		if (event.type === 'MembershipGranted') {
			state = { permissionLevel: event.payload.permissionLevel, revoked: false };
		} else if (event.type === 'MembershipUpdated') {
			state = { ...state, permissionLevel: event.payload.permissionLevel };
		} else if (event.type === 'MembershipRevoked') {
			state = { ...state, revoked: true };
		}
	}
	return state;
}

export interface MembershipContext {
	now: Date;
	/**
	 * UpdateMembership/RevokeMembershipの対象と同じTitleスコープで、
	 * 対象自身を除いて数えた「現在有効なadmin」の人数。
	 * Title横断の集計なので、membership_state投影から数えてShellが渡す（8.3節）。
	 */
	activeAdminCountExcludingTarget: number;
	/** 対象membershipが現在admin権限かどうか（evolveMembershipの結果から判定してShellが渡す） */
	targetIsCurrentlyAdmin: boolean;
}

export function decideMembership(
	command: MembershipCommand,
	context: MembershipContext,
): MembershipDecideResult {
	switch (command.type) {
		case 'GrantMembership': {
			const expiryRequired =
				command.scopeType === 'timeline' || command.personAccountType === 'external';
			if (expiryRequired && command.expiresAt === null) {
				return { ok: false, error: { kind: 'expiry_required' } };
			}
			return {
				ok: true,
				events: [
					{
						type: 'MembershipGranted',
						payload: {
							membershipId: command.membershipId,
							personId: command.personId,
							scopeType: command.scopeType,
							scopeId: command.scopeId,
							permissionLevel: command.permissionLevel,
							processScope: command.processScope,
							grantedBy: command.grantedBy,
							grantedAt: context.now.toISOString(),
							expiresAt: command.expiresAt ? command.expiresAt.toISOString() : null,
						},
					},
				],
			};
		}

		case 'UpdateMembership': {
			const downgradesFromAdmin =
				context.targetIsCurrentlyAdmin && command.permissionLevel !== 'admin';
			if (downgradesFromAdmin && context.activeAdminCountExcludingTarget === 0) {
				return { ok: false, error: { kind: 'last_admin_lockout' } };
			}
			return {
				ok: true,
				events: [
					{
						type: 'MembershipUpdated',
						payload: {
							membershipId: command.membershipId,
							permissionLevel: command.permissionLevel,
							processScope: command.processScope,
						},
					},
				],
			};
		}

		case 'RevokeMembership': {
			if (context.targetIsCurrentlyAdmin && context.activeAdminCountExcludingTarget === 0) {
				return { ok: false, error: { kind: 'last_admin_lockout' } };
			}
			return {
				ok: true,
				events: [
					{
						type: 'MembershipRevoked',
						payload: {
							membershipId: command.membershipId,
							revokedBy: command.revokedBy,
							revokedAt: context.now.toISOString(),
						},
					},
				],
			};
		}
	}
}

export interface MembershipLike {
	expiresAt: Date | null;
	revokedAt: Date | null;
}

/**
 * design.md 8.2節:
 * isActive(membership, now) = revoked_at == null && (expires_at == null || now < expires_at)
 */
export function isMembershipActive(membership: MembershipLike, now: Date): boolean {
	if (membership.revokedAt !== null) return false;
	if (membership.expiresAt !== null && now >= membership.expiresAt) return false;
	return true;
}
