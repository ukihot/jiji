import { and, asc, eq } from 'drizzle-orm';
import type { RepresentationType } from '$lib/core/representation';
import type { SqliteQueryable } from '../../db';
import {
	representation,
	representationCurrentVersion,
	timeline,
	timelineItem,
	title,
} from '../../db/schema';

/**
 * トップページ用の読み取り専用投影。作品→話→カット→成果物を一括で読み、画面側の
 * N+1クエリを避ける。これはイベント正本を変えない表示専用の結合である。
 */
export interface DashboardProductionRow {
	titleId: string;
	titleName: string;
	timelineId: string | null;
	season: string | null;
	episode: number | null;
	cutId: string | null;
	cutNumber: string | null;
	cutSortOrder: number | null;
	representationId: string | null;
	representationType: RepresentationType | null;
	approvedVersionId: string | null;
}

export async function listDashboardProductionRows(
	db: SqliteQueryable,
): Promise<DashboardProductionRow[]> {
	const rows = await db
		.select({
			titleId: title.id,
			titleName: title.name,
			timelineId: timeline.id,
			season: timeline.season,
			episode: timeline.episode,
			cutId: timelineItem.id,
			cutNumber: timelineItem.label,
			cutSortOrder: timelineItem.sortOrder,
			representationId: representation.id,
			representationType: representation.type,
			approvedVersionId: representationCurrentVersion.approvedVersionId,
		})
		.from(title)
		.leftJoin(timeline, eq(timeline.titleId, title.id))
		.leftJoin(
			timelineItem,
			and(eq(timelineItem.timelineId, timeline.id), eq(timelineItem.type, 'cut')),
		)
		.leftJoin(representation, eq(representation.cutId, timelineItem.id))
		.leftJoin(
			representationCurrentVersion,
			eq(representationCurrentVersion.representationId, representation.id),
		)
		.orderBy(
			asc(title.name),
			asc(timeline.episode),
			asc(timelineItem.sortOrder),
			asc(representation.sortOrder),
		);

	return rows.map((row) => ({
		...row,
		representationType: row.representationType as RepresentationType | null,
	}));
}
