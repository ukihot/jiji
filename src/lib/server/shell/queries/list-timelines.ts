import type { SqliteDb } from '../../db';
import { getTitle, listTimelinesByTitle, type TimelineRow, type TitleRow } from '../repository/timeline-repository';

export interface TitleWithTimelines {
	title: TitleRow;
	timelines: TimelineRow[];
}

export async function listTimelinesForTitle(db: SqliteDb, titleId: string): Promise<TitleWithTimelines | null> {
	const title = await getTitle(db, titleId);
	if (!title) return null;
	return { title, timelines: await listTimelinesByTitle(db, titleId) };
}
