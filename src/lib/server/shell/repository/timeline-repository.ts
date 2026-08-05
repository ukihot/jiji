import { asc, eq } from 'drizzle-orm';
import type { SqliteQueryable } from '../../db';
import { cut, timeline, timelineBandView, timelineItem, title } from '../../db/schema';

// ---- title ----

export interface TitleRow {
	id: string;
	name: string;
}

export async function titleExists(db: SqliteQueryable, titleId: string): Promise<boolean> {
	const rows = await db.select({ id: title.id }).from(title).where(eq(title.id, titleId));
	return rows.length > 0;
}

export async function getTitle(db: SqliteQueryable, titleId: string): Promise<TitleRow | null> {
	const rows = await db.select().from(title).where(eq(title.id, titleId));
	return rows[0] ?? null;
}

export async function listTitles(db: SqliteQueryable): Promise<TitleRow[]> {
	return db.select().from(title).orderBy(asc(title.name));
}

export async function insertTitle(db: SqliteQueryable, row: TitleRow): Promise<void> {
	await db.insert(title).values(row);
}

// ---- timeline ----

export interface TimelineRow {
	id: string;
	titleId: string;
	season: string;
	episode: number;
}

export async function getTimeline(
	db: SqliteQueryable,
	timelineId: string,
): Promise<TimelineRow | null> {
	const rows = await db.select().from(timeline).where(eq(timeline.id, timelineId));
	return rows[0] ?? null;
}

export async function listTimelinesByTitle(
	db: SqliteQueryable,
	titleId: string,
): Promise<TimelineRow[]> {
	return db
		.select()
		.from(timeline)
		.where(eq(timeline.titleId, titleId))
		.orderBy(asc(timeline.episode));
}

export async function insertTimeline(db: SqliteQueryable, row: TimelineRow): Promise<void> {
	await db.insert(timeline).values(row);
}

// ---- cut ----
// design.md 4.0.1節: 物理的にはtimeline_item（共通台帳）+ cut（Cut固有属性）の2テーブルに
// 分かれている（cut.id = timeline_item.id）が、Shell層より外にはこのCutRow形状で見せる。

export interface CutRow {
	id: string;
	timelineId: string;
	number: string;
	sortOrder: number;
	plannedFrames: number;
	sceneTags: string[];
}

export async function listCutsByTimeline(
	db: SqliteQueryable,
	timelineId: string,
): Promise<CutRow[]> {
	const rows = await db
		.select({
			id: timelineItem.id,
			timelineId: timelineItem.timelineId,
			number: timelineItem.label,
			sortOrder: timelineItem.sortOrder,
			plannedFrames: timelineItem.widthFrames,
			sceneTags: cut.sceneTags,
		})
		.from(timelineItem)
		.innerJoin(cut, eq(cut.id, timelineItem.id))
		.where(eq(timelineItem.timelineId, timelineId))
		.orderBy(asc(timelineItem.sortOrder));

	return rows.map((row) => ({
		id: row.id,
		timelineId: row.timelineId,
		number: row.number,
		sortOrder: row.sortOrder,
		plannedFrames: row.plannedFrames ?? 0,
		sceneTags: row.sceneTags,
	}));
}

/**
 * timeline_item（共通台帳、type='cut'）とcut（Cut固有属性）へ2行同時にINSERTする。
 * 呼び出し元（コマンドハンドラ）は必ずトランザクション内でこれを呼ぶこと。
 */
export async function insertCut(db: SqliteQueryable, row: CutRow): Promise<void> {
	await db.insert(timelineItem).values({
		id: row.id,
		timelineId: row.timelineId,
		type: 'cut',
		label: row.number,
		sortOrder: row.sortOrder,
		widthFrames: row.plannedFrames,
	});
	await db.insert(cut).values({ id: row.id, sceneTags: row.sceneTags });
}

// ---- timeline_band_view（投影テーブル、design.md 4.1節） ----

export interface BandViewRow {
	timelineItemId: string;
	timelineId: string;
	itemType: 'cut' | 'audio' | 'transition' | 'marker';
	sortOrder: number;
	offsetFrames: number;
	widthFrames: number;
}

export async function listBandView(
	db: SqliteQueryable,
	timelineId: string,
): Promise<BandViewRow[]> {
	return db
		.select()
		.from(timelineBandView)
		.where(eq(timelineBandView.timelineId, timelineId))
		.orderBy(asc(timelineBandView.sortOrder));
}

/**
 * design.md core/projections/timeline-band-view.tsの計算結果で、そのtimelineの帯を丸ごと置き換える。
 * カット数がまだ少ないMVPでは、差分パッチより全再計算のほうが単純で壊れにくい。
 */
export async function replaceBandView(
	db: SqliteQueryable,
	timelineId: string,
	rows: readonly BandViewRow[],
): Promise<void> {
	await db.delete(timelineBandView).where(eq(timelineBandView.timelineId, timelineId));
	for (const row of rows) {
		await db.insert(timelineBandView).values(row);
	}
}
