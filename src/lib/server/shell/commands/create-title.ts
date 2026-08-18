import { decideTimeline, type TimelineError } from '$lib/core/timeline';
import type { MembershipError } from '$lib/core/membership';
import type { SqliteDb } from '../../db';
import { appendEvent } from '../repository/event-repository';
import { insertTitle } from '../repository/timeline-repository';
import { grantMembershipInTx } from './grant-membership';
import { replaceWorkAssignment } from '../repository/work-assignment-repository';

export interface CreateTitleInput {
	name: string;
	/** 作成者。作成と同時にそのTitle全体のadmin membershipを付与する（最後のadminロックアウト防止の起点） */
	createdBy: string;
	assigneeId: string;
}

export type CreateTitleResult =
	| { ok: true; titleId: string }
	| { ok: false; error: TimelineError | MembershipError | { kind: 'person_not_found' } };

/** design.md 2.2節のコマンドハンドラの型: イベント列取得→evolve→decide→同一トランザクションで追記＋更新 */
export async function createTitle(
	db: SqliteDb,
	input: CreateTitleInput,
): Promise<CreateTitleResult> {
	const titleId = crypto.randomUUID();
	const now = new Date();
	return db.transaction(async (tx): Promise<CreateTitleResult> => {
		const decision = decideTimeline(
			{ type: 'CreateTitle', titleId, name: input.name },
			{ cutNumbers: new Set(), cutSortOrders: new Set() },
			{ titleExists: false },
		);
		if (!decision.ok) return { ok: false, error: decision.error };

		await appendEvent(tx, 'title', titleId, decision.events[0], now);
		await insertTitle(tx, { id: titleId, name: input.name });
		await replaceWorkAssignment(tx, {
			id: crypto.randomUUID(),
			targetType: 'title',
			targetId: titleId,
			assigneeId: input.assigneeId,
			assignedAt: now,
		});

		// design.md 8.3節「最後のadminロックアウト防止」の起点：作成者を自動でこのTitleのadminにする
		const grantResult = await grantMembershipInTx(
			tx,
			{
				personId: input.createdBy,
				scopeType: 'title',
				scopeId: titleId,
				permissionLevel: 'admin',
				processScope: null,
				grantedBy: input.createdBy,
				expiresAt: null,
			},
			now,
		);
		if (!grantResult.ok) return { ok: false, error: grantResult.error };

		return { ok: true, titleId };
	});
}
