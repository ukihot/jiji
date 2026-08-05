/**
 * design.md 8.5章: 外部作業者向けの時限アクセス（share_link）と、
 * 8.5.2節 Magic Identity（名前入力だけの軽量な本人識別）のCore。
 */

export type SharePermissionLevel = 'viewer' | 'contributor';

export type ShareLinkEvent =
	| {
			type: 'ShareLinkCreated';
			payload: {
				shareLinkId: string;
				targetCutIds: string[];
				permissionLevel: SharePermissionLevel;
				createdBy: string;
				createdAt: string; // ISO
				expiresAt: string; // ISO
			};
	  }
	| {
			type: 'ShareLinkClaimed';
			payload: { shareLinkId: string; personId: string; name: string; claimedAt: string };
	  }
	| {
			type: 'ShareLinkRevoked';
			payload: { shareLinkId: string; revokedBy: string; revokedAt: string };
	  };

export type ShareLinkCommand =
	| {
			type: 'CreateShareLink';
			shareLinkId: string;
			targetCutIds: string[];
			permissionLevel: SharePermissionLevel;
			createdBy: string;
			expiresAt: Date;
	  }
	| { type: 'ClaimShareLink'; shareLinkId: string; personId: string; name: string }
	| { type: 'RevokeShareLink'; shareLinkId: string; revokedBy: string };

/** design.md 4章: ShareLinkの有効期限は既定7日・最長90日（既定値はUI側の提案、上限はここで強制） */
export const SHARE_LINK_MAX_DURATION_MS = 90 * 24 * 60 * 60 * 1000;

export type ShareLinkError =
	| { kind: 'no_target_cuts' }
	| { kind: 'expiry_in_past' }
	| { kind: 'expiry_too_far'; maxDurationMs: number }
	| { kind: 'blank_name' }
	| { kind: 'link_inactive' }
	| { kind: 'already_claimed' }
	| { kind: 'already_revoked' };

export type ShareLinkDecideResult =
	| { ok: true; events: ShareLinkEvent[] }
	| { ok: false; error: ShareLinkError };

export interface ShareLinkContext {
	now: Date;
	/** そのshare_linkが現在有効（未失効・未取消）か。ClaimShareLink/RevokeShareLinkで使う */
	isActive: boolean;
	/** 既にclaim済みならそのpersonId（Magic Identityは「同一トークン＝同一人物」を1回だけ確定させる） */
	alreadyClaimedPersonId: string | null;
	/** 既にrevoke済みか */
	alreadyRevoked: boolean;
}

export function decideShareLink(
	command: ShareLinkCommand,
	context: ShareLinkContext
): ShareLinkDecideResult {
	switch (command.type) {
		case 'CreateShareLink': {
			if (command.targetCutIds.length === 0) {
				return { ok: false, error: { kind: 'no_target_cuts' } };
			}
			if (command.expiresAt.getTime() <= context.now.getTime()) {
				return { ok: false, error: { kind: 'expiry_in_past' } };
			}
			if (command.expiresAt.getTime() - context.now.getTime() > SHARE_LINK_MAX_DURATION_MS) {
				return { ok: false, error: { kind: 'expiry_too_far', maxDurationMs: SHARE_LINK_MAX_DURATION_MS } };
			}
			return {
				ok: true,
				events: [
					{
						type: 'ShareLinkCreated',
						payload: {
							shareLinkId: command.shareLinkId,
							targetCutIds: command.targetCutIds,
							permissionLevel: command.permissionLevel,
							createdBy: command.createdBy,
							createdAt: context.now.toISOString(),
							expiresAt: command.expiresAt.toISOString()
						}
					}
				]
			};
		}

		case 'ClaimShareLink': {
			if (!context.isActive) return { ok: false, error: { kind: 'link_inactive' } };
			if (context.alreadyClaimedPersonId !== null) {
				return { ok: false, error: { kind: 'already_claimed' } };
			}
			if (command.name.trim().length === 0) return { ok: false, error: { kind: 'blank_name' } };
			return {
				ok: true,
				events: [
					{
						type: 'ShareLinkClaimed',
						payload: {
							shareLinkId: command.shareLinkId,
							personId: command.personId,
							name: command.name,
							claimedAt: context.now.toISOString()
						}
					}
				]
			};
		}

		case 'RevokeShareLink': {
			if (context.alreadyRevoked) return { ok: false, error: { kind: 'already_revoked' } };
			return {
				ok: true,
				events: [
					{
						type: 'ShareLinkRevoked',
						payload: {
							shareLinkId: command.shareLinkId,
							revokedBy: command.revokedBy,
							revokedAt: context.now.toISOString()
						}
					}
				]
			};
		}
	}
}

export interface ShareLinkAggregateState {
	claimedPersonId: string | null;
	revoked: boolean;
}

export function evolveShareLink(events: readonly ShareLinkEvent[]): ShareLinkAggregateState {
	let state: ShareLinkAggregateState = { claimedPersonId: null, revoked: false };
	for (const event of events) {
		if (event.type === 'ShareLinkClaimed') {
			state = { ...state, claimedPersonId: event.payload.personId };
		} else if (event.type === 'ShareLinkRevoked') {
			state = { ...state, revoked: true };
		}
	}
	return state;
}

export interface ShareLinkLike {
	expiresAt: Date;
	revokedAt: Date | null;
}

/** design.md 8.2節isActiveと同型。share_linkのexpires_atはNOT NULL（無期限を選べない）なのでnullチェックは無い */
export function isShareLinkActive(shareLink: ShareLinkLike, now: Date): boolean {
	if (shareLink.revokedAt !== null) return false;
	return now < shareLink.expiresAt;
}
