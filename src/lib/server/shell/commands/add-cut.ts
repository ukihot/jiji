import {
	decideTimeline,
	evolveTimeline,
	type TimelineError,
	type TimelineEvent,
} from '$lib/core/timeline';
import { projectTimelineBandView } from '$lib/core/projections/timeline-band-view';
import type { SqliteDb } from '../../db';
import { appendEvent, getEventsByTarget } from '../repository/event-repository';
import { insertCut, listCutsByTimeline, replaceBandView } from '../repository/timeline-repository';
import { replaceWorkAssignment } from '../repository/work-assignment-repository';

export interface AddCutInput {
	timelineId: string;
	number: string;
	sortOrder: number;
	plannedFrames: number;
	sceneTags: string[];
	assigneeId: string;
}

export type AddCutResult = { ok: true; cutId: string } | { ok: false; error: TimelineError };

export async function addCut(db: SqliteDb, input: AddCutInput): Promise<AddCutResult> {
	const cutId = crypto.randomUUID();
	const now = new Date();
	return db.transaction(async (tx): Promise<AddCutResult> => {
		// design.md 2.2節: Shellがそのtimelineのイベント列を取得し、Coreがevolveで現在状態を作る
		const rawEvents = await getEventsByTarget(tx, 'timeline', input.timelineId);
		const events = rawEvents.map((row) => row as unknown as TimelineEvent);
		const state = evolveTimeline(events);

		const decision = decideTimeline(
			{
				type: 'AddCut',
				cutId,
				timelineId: input.timelineId,
				number: input.number,
				sortOrder: input.sortOrder,
				plannedFrames: input.plannedFrames,
				sceneTags: input.sceneTags,
			},
			state,
			{ titleExists: true }, // AddCutのdecideはtitleExistsを参照しない
		);
		if (!decision.ok) return { ok: false, error: decision.error };

		await appendEvent(tx, 'timeline', input.timelineId, decision.events[0], now);
		await insertCut(tx, {
			id: cutId,
			timelineId: input.timelineId,
			number: input.number,
			sortOrder: input.sortOrder,
			plannedFrames: input.plannedFrames,
			sceneTags: input.sceneTags,
		});
		await replaceWorkAssignment(tx, {
			id: crypto.randomUUID(),
			targetType: 'cut',
			targetId: cutId,
			assigneeId: input.assigneeId,
			assignedAt: now,
		});

		// design.md 2.3節/4.1節: 同一トランザクションでtimeline_band_view投影を更新する
		const cuts = await listCutsByTimeline(tx, input.timelineId);
		const bandRows = projectTimelineBandView(
			input.timelineId,
			cuts.map((c) => ({ cutId: c.id, sortOrder: c.sortOrder, plannedFrames: c.plannedFrames })),
		);
		// design.md 4.0.1節: CoreはTimelineItem/物理スキーマを知らない（cutIdのまま）ため、
		// ここShell側でtimeline_item_id/item_typeへ変換してから投影テーブルへ書く。
		await replaceBandView(
			tx,
			input.timelineId,
			bandRows.map((row) => ({
				timelineItemId: row.cutId,
				timelineId: row.timelineId,
				itemType: 'cut' as const,
				sortOrder: row.sortOrder,
				offsetFrames: row.offsetFrames,
				widthFrames: row.widthFrames,
			})),
		);

		return { ok: true, cutId };
	});
}
