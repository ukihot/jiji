/**
 * design.md 4.1節 timeline_band_view / 7章 タイムライン帯表示のためのproject関数。
 *
 * CutAddedのたびにtimeline全体を並べ直す（挿入位置によって後続カットのoffsetが
 * ずれるため、差分パッチではなくCut一覧全体からの再計算にしている）。
 */

export interface CutForBandView {
	cutId: string;
	sortOrder: number;
	plannedFrames: number;
}

export interface BandViewRow {
	cutId: string;
	timelineId: string;
	sortOrder: number;
	offsetFrames: number;
	widthFrames: number;
}

export function projectTimelineBandView(
	timelineId: string,
	cuts: readonly CutForBandView[],
): BandViewRow[] {
	const sorted = [...cuts].sort((a, b) => a.sortOrder - b.sortOrder);
	let offset = 0;
	const rows: BandViewRow[] = [];
	for (const cut of sorted) {
		rows.push({
			cutId: cut.cutId,
			timelineId,
			sortOrder: cut.sortOrder,
			offsetFrames: offset,
			widthFrames: cut.plannedFrames,
		});
		offset += cut.plannedFrames;
	}
	return rows;
}
