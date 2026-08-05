import type { SqliteDb } from '../../db';
import { getTimeline, getTitle, listBandView, listCutsByTimeline } from '../repository/timeline-repository';

/** design.md 7章 Timeline Viewerの最小表示に必要な形（帯表示用にoffset/widthを含む） */
export interface TimelineViewCut {
	cutId: string;
	number: string;
	sortOrder: number;
	plannedFrames: number;
	sceneTags: string[];
	offsetFrames: number;
	widthFrames: number;
}

export interface TimelineView {
	title: { id: string; name: string };
	timeline: { id: string; season: string; episode: number };
	cuts: TimelineViewCut[];
	totalFrames: number;
}

export async function getTimelineView(db: SqliteDb, titleId: string, timelineId: string): Promise<TimelineView | null> {
	const title = await getTitle(db, titleId);
	const timeline = await getTimeline(db, timelineId);
	if (!title || !timeline || timeline.titleId !== titleId) return null;

	const cuts = await listCutsByTimeline(db, timelineId);
	const band = new Map((await listBandView(db, timelineId)).map((row) => [row.timelineItemId, row]));

	const viewCuts: TimelineViewCut[] = cuts.map((cut) => {
		const bandRow = band.get(cut.id);
		return {
			cutId: cut.id,
			number: cut.number,
			sortOrder: cut.sortOrder,
			plannedFrames: cut.plannedFrames,
			sceneTags: cut.sceneTags,
			offsetFrames: bandRow?.offsetFrames ?? 0,
			widthFrames: bandRow?.widthFrames ?? cut.plannedFrames
		};
	});

	const totalFrames = viewCuts.reduce((sum, c) => Math.max(sum, c.offsetFrames + c.widthFrames), 0);

	return {
		title: { id: title.id, name: title.name },
		timeline: { id: timeline.id, season: timeline.season, episode: timeline.episode },
		cuts: viewCuts,
		totalFrames
	};
}
