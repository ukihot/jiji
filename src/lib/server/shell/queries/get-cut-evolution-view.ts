import {
	REPRESENTATION_TYPES,
	type DerivedFromRelation,
	type RepresentationType,
	type ReviewResult,
} from '$lib/core/representation';
import type { SqliteDb } from '../../db';
import {
	getSealByVersion,
	listRepresentationCurrentVersionsByCut,
	listRepresentationsByCut,
	listReviewsByVersion,
	listVersionsByRepresentation,
	type VersionWithSubmissionRow,
} from '../repository/production-repository';
import { getCut, getTimeline, getTitle } from '../repository/timeline-repository';
import { listPersons } from '../repository/person-repository';

export interface CutEvolutionReviewView {
	reviewId: string;
	reviewerId: string;
	reviewerName: string;
	result: ReviewResult;
	comment: string | null;
	reviewedAt: Date;
}

export interface CutEvolutionSealView {
	sealId: string;
	hash: string;
	sealedBy: string;
	sealedByName: string;
	sealedAt: Date;
}

export interface CutEvolutionDerivedFromView {
	versionId: string;
	relation: DerivedFromRelation;
	/** 参照元Versionが属するRepresentation種別とseq。表示用ラベル組み立てに使う（例: "Layout v5から"） */
	representationType: RepresentationType;
	seq: number;
}

export interface CutEvolutionVersionView {
	versionId: string;
	seq: number;
	fileRef: string;
	proxyRef: string | null;
	processStep: string;
	submittedBy: string;
	submittedByName: string;
	submittedAt: Date;
	isLatest: boolean;
	isApproved: boolean;
	derivedFrom: CutEvolutionDerivedFromView | null;
	seal: CutEvolutionSealView | null;
	reviews: CutEvolutionReviewView[];
}

/** design.md 7.5節 Cut Evolution Viewerの1カラム分。representationIdがnullなら「未提出」表示にする */
export interface CutEvolutionRepresentationView {
	representationId: string | null;
	type: RepresentationType;
	latestVersionId: string | null;
	approvedVersionId: string | null;
	versions: CutEvolutionVersionView[];
}

export interface CutEvolutionView {
	title: { id: string; name: string };
	timeline: { id: string; season: string; episode: number };
	cut: { id: string; number: string };
	representations: CutEvolutionRepresentationView[];
	/** 「元にしたバージョン」選択用。Cut内の全Representation・全Versionをまとめたもの（提出フォームで使う） */
	allVersionsForDerivedFrom: Array<{
		versionId: string;
		representationType: RepresentationType;
		seq: number;
	}>;
}

/**
 * design.md 7.5節: Cut Evolution Viewerの表示に必要な全データを1回で組み立てる。
 * REPRESENTATION_TYPES（固定8種、4.4節の並び順）を軸に、未提出のRepresentationも
 * 「まだ無い」状態として空の列で表示する（P-06: 事前のセットアップ操作を要求しない）。
 */
export async function getCutEvolutionView(
	db: SqliteDb,
	titleId: string,
	timelineId: string,
	cutId: string,
): Promise<CutEvolutionView | null> {
	const title = await getTitle(db, titleId);
	const timeline = await getTimeline(db, timelineId);
	const cut = await getCut(db, cutId);
	if (
		!title ||
		!timeline ||
		!cut ||
		timeline.titleId !== titleId ||
		cut.timelineId !== timelineId
	) {
		return null;
	}

	const persons = await listPersons(db);
	const personNameById = new Map(persons.map((person) => [person.id, person.name]));

	const repByType = new Map(
		(await listRepresentationsByCut(db, cutId)).map((row) => [row.type, row]),
	);
	const currentByType = new Map(
		(await listRepresentationCurrentVersionsByCut(db, cutId)).map((row) => [row.type, row]),
	);

	// 1周目: このCut全体のVersionを先にすべて集め、derivedFromのラベル解決（どのRepresentation/seqか）に使う
	const versionsByType = new Map<RepresentationType, VersionWithSubmissionRow[]>();
	const versionLabelById = new Map<
		string,
		{ representationType: RepresentationType; seq: number }
	>();
	for (const type of REPRESENTATION_TYPES) {
		const rep = repByType.get(type);
		if (!rep) continue;
		const versions = await listVersionsByRepresentation(db, rep.id);
		versionsByType.set(type, versions);
		for (const v of versions) {
			versionLabelById.set(v.id, { representationType: type, seq: v.seq });
		}
	}

	// 2周目: 各Versionの表示用ビューを組み立てる（reviews/seal/derivedFromラベルを解決）
	const representations: CutEvolutionRepresentationView[] = await Promise.all(
		REPRESENTATION_TYPES.map(async (type): Promise<CutEvolutionRepresentationView> => {
			const rep = repByType.get(type);
			const current = currentByType.get(type);
			if (!rep) {
				return {
					representationId: null,
					type,
					latestVersionId: null,
					approvedVersionId: null,
					versions: [],
				};
			}

			const versionsRaw = versionsByType.get(type) ?? [];
			const versions = await Promise.all(
				versionsRaw.map(async (v): Promise<CutEvolutionVersionView> => {
					const reviewsRaw = await listReviewsByVersion(db, v.id);
					const isApproved = v.id === (current?.approvedVersionId ?? null);
					const sealRow = isApproved ? await getSealByVersion(db, v.id) : null;
					const derivedLabel = v.derivedFromVersionId
						? versionLabelById.get(v.derivedFromVersionId)
						: undefined;

					return {
						versionId: v.id,
						seq: v.seq,
						fileRef: v.fileRef,
						proxyRef: v.proxyRef,
						processStep: v.processStep,
						submittedBy: v.submittedBy,
						submittedByName: personNameById.get(v.submittedBy) ?? v.submittedBy,
						submittedAt: v.submittedAt,
						isLatest: v.id === (current?.latestVersionId ?? null),
						isApproved,
						derivedFrom:
							v.derivedFromVersionId && v.derivedFromRelation && derivedLabel
								? {
										versionId: v.derivedFromVersionId,
										relation: v.derivedFromRelation,
										representationType: derivedLabel.representationType,
										seq: derivedLabel.seq,
									}
								: null,
						seal: sealRow
							? {
									sealId: sealRow.id,
									hash: sealRow.hash,
									sealedBy: sealRow.sealedBy,
									sealedByName: personNameById.get(sealRow.sealedBy) ?? sealRow.sealedBy,
									sealedAt: sealRow.sealedAt,
								}
							: null,
						reviews: reviewsRaw.map((r) => ({
							reviewId: r.id,
							reviewerId: r.reviewerId,
							reviewerName: personNameById.get(r.reviewerId) ?? r.reviewerId,
							result: r.result,
							comment: r.comment,
							reviewedAt: r.reviewedAt,
						})),
					};
				}),
			);

			return {
				representationId: rep.id,
				type,
				latestVersionId: current?.latestVersionId ?? null,
				approvedVersionId: current?.approvedVersionId ?? null,
				versions,
			};
		}),
	);

	const allVersionsForDerivedFrom = [...versionLabelById.entries()].map(([versionId, label]) => ({
		versionId,
		representationType: label.representationType,
		seq: label.seq,
	}));

	return {
		title: { id: title.id, name: title.name },
		timeline: { id: timeline.id, season: timeline.season, episode: timeline.episode },
		cut: { id: cut.id, number: cut.number },
		representations,
		allVersionsForDerivedFrom,
	};
}
