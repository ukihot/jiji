import { decideTimeline, type TimelineError } from '$lib/core/timeline';
import type { SqliteDb } from '../../db';
import { appendEvent } from '../repository/event-repository';
import { insertTimeline, titleExists } from '../repository/timeline-repository';
import { replaceWorkAssignment } from '../repository/work-assignment-repository';

export interface CreateTimelineInput {
	titleId: string;
	season: string;
	episode: number;
	assigneeId: string;
}

export type CreateTimelineResult =
	| { ok: true; timelineId: string }
	| { ok: false; error: TimelineError };

export async function createTimeline(
	db: SqliteDb,
	input: CreateTimelineInput,
): Promise<CreateTimelineResult> {
	const timelineId = crypto.randomUUID();
	const now = new Date();
	return db.transaction(async (tx): Promise<CreateTimelineResult> => {
		const decision = decideTimeline(
			{
				type: 'CreateTimeline',
				timelineId,
				titleId: input.titleId,
				season: input.season,
				episode: input.episode,
			},
			{ cutNumbers: new Set(), cutSortOrders: new Set() },
			{ titleExists: await titleExists(tx, input.titleId) },
		);
		if (!decision.ok) return { ok: false, error: decision.error };

		await appendEvent(tx, 'timeline', timelineId, decision.events[0], now);
		await insertTimeline(tx, {
			id: timelineId,
			titleId: input.titleId,
			season: input.season,
			episode: input.episode,
		});
		await replaceWorkAssignment(tx, {
			id: crypto.randomUUID(),
			targetType: 'timeline',
			targetId: timelineId,
			assigneeId: input.assigneeId,
			assignedAt: now,
		});

		return { ok: true, timelineId };
	});
}
