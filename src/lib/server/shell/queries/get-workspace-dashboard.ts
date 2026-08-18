import type { SqliteDb } from '../../db';
import type { RepresentationType } from '$lib/core/representation';
import * as m from '$lib/paraglide/messages';
import { listRecentEvents } from '../repository/event-repository';
import { listDashboardProductionRows } from '../repository/dashboard-repository';
import { listTitles, type TitleRow } from '../repository/timeline-repository';
import { listWorkAssignments } from '../repository/work-assignment-repository';
import { getCutEvolutionView } from './get-cut-evolution-view';

const REPRESENTATION_TYPE_LABEL: Record<RepresentationType, () => string> = {
	storyboard: m.representation_type_storyboard,
	animatic: m.representation_type_animatic,
	layout: m.representation_type_layout,
	animation: m.representation_type_animation,
	bg: m.representation_type_bg,
	cg_render: m.representation_type_cg_render,
	composite: m.representation_type_composite,
	final: m.representation_type_final,
};

/** 割当済みの制作対象を、各人にとってのタスクとして表示する。自由入力タスクは持たない。 */
export async function getWorkspaceDashboard(
	db: SqliteDb,
	personId: string,
	titlesPromise: Promise<TitleRow[]> = listTitles(db),
) {
	const [assignments, activity, titles, productionRows] = await Promise.all([
		listWorkAssignments(db),
		listRecentEvents(db, 12),
		titlesPromise,
		listDashboardProductionRows(db),
	]);
	const targetByKey = new Map<string, { label: string; href: string; isDone: boolean }>();
	const representationDone = new Map<string, boolean>();
	const frontierItems: Array<{
		id: string;
		label: string;
		href: string;
		processName: string;
	}> = [];
	const assignedRepresentationIds = new Set(
		assignments
			.filter(
				(assignment) =>
					assignment.assigneeId === personId && assignment.targetType === 'representation',
			)
			.map((assignment) => assignment.targetId),
	);

	for (const title of titles) {
		targetByKey.set(`title:${title.id}`, {
			label: title.name,
			href: `/${title.id}`,
			isDone: false,
		});
	}

	const frontierCuts = new Map<
		string,
		{
			titleId: string;
			timelineId: string;
			cutId: string;
			titleName: string;
			season: string;
			episode: number;
			cutNumber: string;
		}
	>();
	for (const row of productionRows) {
		if (!row.timelineId || row.episode === null) continue;
		const episodeLabel = m.episode_label({ season: row.season ?? '', episode: row.episode });
		targetByKey.set(`timeline:${row.timelineId}`, {
			label: `${row.titleName} / ${episodeLabel}`,
			href: `/${row.titleId}/${row.timelineId}`,
			isDone: false,
		});
		if (!row.cutId || !row.cutNumber) continue;
		const cutHref = `/${row.titleId}/${row.timelineId}/cuts/${row.cutId}`;
		targetByKey.set(`cut:${row.cutId}`, {
			label: `${row.titleName} / ${episodeLabel} / ${row.cutNumber}`,
			href: cutHref,
			isDone: false,
		});
		if (!row.representationId || !row.representationType) continue;
		const isDone = row.approvedVersionId !== null;
		representationDone.set(row.representationId, isDone);
		targetByKey.set(`representation:${row.representationId}`, {
			label: `${row.titleName} / ${episodeLabel} / ${row.cutNumber} / ${REPRESENTATION_TYPE_LABEL[row.representationType]()}`,
			href: cutHref,
			isDone,
		});
		if (assignedRepresentationIds.has(row.representationId)) {
			frontierCuts.set(row.cutId, {
				titleId: row.titleId,
				timelineId: row.timelineId,
				cutId: row.cutId,
				titleName: row.titleName,
				season: row.season ?? '',
				episode: row.episode,
				cutNumber: row.cutNumber,
			});
		}
	}

	// Frontierは「担当済み」ではなく、依存・証跡・最新版を満たして今開始できる対象だけを返す。
	// 対象カットだけを読むため、作品内の全カット数に比例してCut Evolutionを組み立てない。
	const frontierViews = await Promise.all(
		[...frontierCuts.values()].map(async (cut) => ({
			cut,
			evolution: await getCutEvolutionView(db, cut.titleId, cut.timelineId, cut.cutId),
		})),
	);
	for (const { cut, evolution } of frontierViews) {
		for (const node of evolution?.handoff?.nodes ?? []) {
			if (node.status !== 'ready' || node.artistId !== personId) continue;
			frontierItems.push({
				id: `${cut.cutId}:${node.processNodeId}`,
				label: `${cut.titleName} / ${m.episode_label({ season: cut.season, episode: cut.episode })} / ${cut.cutNumber}`,
				href: `/${cut.titleId}/${cut.timelineId}/cuts/${cut.cutId}`,
				processName: node.displayName,
			});
		}
	}

	const workItems = assignments
		.filter((assignment) => assignment.assigneeId === personId)
		.flatMap((assignment) => {
			const target = targetByKey.get(`${assignment.targetType}:${assignment.targetId}`);
			return target ? [{ ...assignment, ...target }] : [];
		});

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const burndown = Array.from({ length: 14 }, (_, index) => {
		const date = new Date(today);
		date.setDate(today.getDate() - (13 - index));
		const end = new Date(date);
		end.setDate(date.getDate() + 1);
		return {
			date: date.toISOString(),
			remaining: assignments.filter(
				(assignment) =>
					assignment.targetType === 'representation' &&
					assignment.assignedAt < end &&
					!representationDone.get(assignment.targetId),
			).length,
		};
	});
	return { workItems, frontierItems, activity, burndown };
}
