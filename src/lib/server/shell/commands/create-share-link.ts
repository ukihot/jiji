import {
	decideShareLink,
	type ShareLinkError,
	type SharePermissionLevel,
} from '$lib/core/share-link';
import { generateShareToken, hashShareToken } from '../../auth/share-token';
import type { SqliteDb } from '../../db';
import { appendEvent } from '../repository/event-repository';
import { insertShareLink } from '../repository/share-link-repository';

export interface CreateShareLinkInput {
	targetCutIds: string[];
	permissionLevel: SharePermissionLevel;
	createdBy: string;
	expiresAt: Date;
}

export type CreateShareLinkResult =
	| { ok: true; shareLinkId: string; token: string }
	| { ok: false; error: ShareLinkError };

/**
 * design.md 8.5節。戻り値のtokenはこの呼び出し時にしか手に入らない
 * （DBにはtokenHashしか保存しない。パスワードリセットトークンと同じ扱い）。
 */
export async function createShareLink(
	db: SqliteDb,
	input: CreateShareLinkInput,
): Promise<CreateShareLinkResult> {
	const shareLinkId = crypto.randomUUID();
	const now = new Date();
	const token = generateShareToken();
	const tokenHash = hashShareToken(token);

	return db.transaction(async (tx): Promise<CreateShareLinkResult> => {
		const decision = decideShareLink(
			{
				type: 'CreateShareLink',
				shareLinkId,
				targetCutIds: input.targetCutIds,
				permissionLevel: input.permissionLevel,
				createdBy: input.createdBy,
				expiresAt: input.expiresAt,
			},
			{ now, isActive: true, alreadyClaimedPersonId: null, alreadyRevoked: false },
		);
		if (!decision.ok) return { ok: false, error: decision.error };

		await appendEvent(tx, 'share_link', shareLinkId, decision.events[0], now);
		await insertShareLink(tx, {
			id: shareLinkId,
			tokenHash,
			targetCutIds: input.targetCutIds,
			permissionLevel: input.permissionLevel,
			claimedPersonId: null,
			expiresAt: input.expiresAt,
			createdBy: input.createdBy,
			createdAt: now,
			revokedAt: null,
		});

		return { ok: true, shareLinkId, token };
	});
}
