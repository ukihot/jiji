import {
	REPRESENTATION_TYPES,
	applyRepresentationTypesDefault,
	type DerivedFromRelation,
	type RepresentationType,
	type ReviewResult,
} from '$lib/core/representation';
import {
	deriveReadiness,
	explainReadiness,
	projectRipple,
	type ImpactSeverity,
	type ReadinessReasonCode,
	type ReadinessStatus,
} from '$lib/core/production-kernel';
import type { SqliteDb } from '../../db';
import {
	getSealByVersion,
	getPublishedBlueprint,
	listEnabledRepresentationTypes,
	listActiveStudioTerms,
	listGateEvidenceForGates,
	listProcessEdges,
	listProcessNodes,
	listRepresentationCurrentVersionsByCut,
	listRepresentationsByCut,
	listReviewGatesForNodes,
	listReviewsByVersion,
	listVersionsByRepresentation,
	type VersionWithSubmissionRow,
} from '../repository/production-repository';
import { getCut, getTimeline, getTitle } from '../repository/timeline-repository';
import { listPersons } from '../repository/person-repository';
import { listWorkAssignments } from '../repository/work-assignment-repository';

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
	/** このTitleで現在有効か（プロジェクト設定）。無効でも過去の提出があれば列自体は表示する */
	isEnabled: boolean;
	latestVersionId: string | null;
	approvedVersionId: string | null;
	versions: CutEvolutionVersionView[];
	assignee: { id: string; name: string } | null;
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
	/** Blueprint + 現在の版・割当・ゲート証跡から都度導く、開始・受け渡し可能性。 */
	handoff: {
		blueprintVersion: number;
		nodes: Array<{
			processNodeId: string;
			capabilityKey: string;
			displayName: string;
			status: ReadinessStatus;
			reason: ReadinessReasonCode;
			blockedByProcessNodeIds: string[];
			artistId: string | null;
			artistName: string | null;
			latestVersionId: string | null;
			gateId: string | null;
			gateRequired: boolean;
			ripple: Array<{
				processNodeId: string;
				displayName: string;
				severity: ImpactSeverity;
				distance: number;
				path: string[];
			}>;
		}>;
	} | null;
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
	const assignments = await listWorkAssignments(db);
	const assignmentByTargetId = new Map(
		assignments.map((assignment) => [assignment.targetId, assignment]),
	);
	const personNameById = new Map(persons.map((person) => [person.id, person.name]));

	const repByType = new Map(
		(await listRepresentationsByCut(db, cutId)).map((row) => [row.type, row]),
	);
	const currentByType = new Map(
		(await listRepresentationCurrentVersionsByCut(db, cutId)).map((row) => [row.type, row]),
	);

	// design.md 4.0.2節改訂: プロジェクト設定で無効化された種別は、過去の提出が無い限り列自体を出さない
	// （P-04: 過去は消さないので、無効化後も既存の提出履歴は引き続き見える）
	const enabledTypes = applyRepresentationTypesDefault(
		await listEnabledRepresentationTypes(db, titleId),
	);
	const visibleTypes = REPRESENTATION_TYPES.filter(
		(type) => enabledTypes.has(type) || repByType.has(type),
	);

	// 1周目: このCut全体のVersionを先にすべて集め、derivedFromのラベル解決（どのRepresentation/seqか）に使う
	const versionsByType = new Map<RepresentationType, VersionWithSubmissionRow[]>();
	const versionLabelById = new Map<
		string,
		{ representationType: RepresentationType; seq: number }
	>();
	for (const type of visibleTypes) {
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
		visibleTypes.map(async (type): Promise<CutEvolutionRepresentationView> => {
			const rep = repByType.get(type);
			const current = currentByType.get(type);
			const isEnabled = enabledTypes.has(type);
			if (!rep) {
				return {
					representationId: null,
					type,
					isEnabled,
					latestVersionId: null,
					approvedVersionId: null,
					versions: [],
					assignee: null,
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
				isEnabled,
				latestVersionId: current?.latestVersionId ?? null,
				approvedVersionId: current?.approvedVersionId ?? null,
				versions,
				assignee: (() => {
					const assignment = assignmentByTargetId.get(rep.id);
					return assignment
						? {
								id: assignment.assigneeId,
								name: assignment.assigneeName,
							}
						: null;
				})(),
			};
		}),
	);

	const allVersionsForDerivedFrom = [...versionLabelById.entries()].map(([versionId, label]) => ({
		versionId,
		representationType: label.representationType,
		seq: label.seq,
	}));

	const blueprint = await getPublishedBlueprint(db, titleId);
	let handoff: CutEvolutionView['handoff'] = null;
	if (blueprint) {
		const [nodes, edges, terms] = await Promise.all([
			listProcessNodes(db, blueprint.id),
			listProcessEdges(db, blueprint.id),
			listActiveStudioTerms(db, titleId),
		]);
		const gates = await listReviewGatesForNodes(
			db,
			nodes.map((node) => node.id),
		);
		const evidences = await listGateEvidenceForGates(
			db,
			gates.map((gate) => gate.id),
		);
		const reprViewByType = new Map(
			representations.map((representation) => [representation.type, representation]),
		);
		const gatesByNodeId = new Map(gates.map((gate) => [gate.processNodeId, gate]));
		const evidencesByGateId = new Map<string, typeof evidences>();
		for (const evidence of evidences) {
			evidencesByGateId.set(evidence.gateId, [
				...(evidencesByGateId.get(evidence.gateId) ?? []),
				evidence,
			]);
		}
		const requiredPredecessors = new Map<string, string[]>();
		for (const edge of edges) {
			if (edge.relation === 'requires') {
				requiredPredecessors.set(edge.toNodeId, [
					...(requiredPredecessors.get(edge.toNodeId) ?? []),
					edge.fromNodeId,
				]);
			}
		}
		const termByCapability = new Map(terms.map((term) => [term.capabilityKey, term.displayName]));
		const nodeById = new Map(nodes.map((node) => [node.id, node]));
		const readinessByNodeId = new Map<string, ReadinessStatus>();
		const reasonByNodeId = new Map<string, ReadinessReasonCode>();
		const blockedByNodeId = new Map<string, string[]>();
		const calculating = new Set<string>();
		const now = new Date();
		const readinessFor = (nodeId: string): ReadinessStatus => {
			const cached = readinessByNodeId.get(nodeId);
			if (cached) return cached;
			// 公開時に循環は拒否している。壊れた投影を読んだ時にも画面を止めないため保守的にブロックする。
			if (calculating.has(nodeId)) return 'not_ready';
			calculating.add(nodeId);
			const node = nodeById.get(nodeId);
			if (!node) return 'not_ready';
			const representationView = node.representationType
				? reprViewByType.get(node.representationType)
				: undefined;
			const latestVersionId = representationView?.latestVersionId ?? null;
			const gate = gatesByNodeId.get(nodeId);
			const gateEvidence = gate ? (evidencesByGateId.get(gate.id) ?? []) : [];
			const hasCurrentGateEvidence = Boolean(
				latestVersionId &&
					gateEvidence.some(
						(evidence) => evidence.versionId === latestVersionId && evidence.result === 'passed',
					),
			);
			const hasStaleGateEvidence = Boolean(
				latestVersionId &&
					!hasCurrentGateEvidence &&
					gateEvidence.some(
						(evidence) => evidence.versionId !== latestVersionId && evidence.result === 'passed',
					),
			);
			const blockedByProcessNodeIds = (requiredPredecessors.get(nodeId) ?? []).filter(
				(predecessorId) => {
					const predecessor = readinessFor(predecessorId);
					return predecessor !== 'passed' && predecessor !== 'waived';
				},
			);
			const evidence = {
				nodeId,
				hasLatestVersion: latestVersionId !== null,
				hasCurrentGateEvidence,
				hasStaleGateEvidence,
				waivedUntil: null,
				artistAssigned: representationView?.assignee !== null && representationView !== undefined,
				blockedByRequiredDependency: blockedByProcessNodeIds.length > 0,
			};
			const status = deriveReadiness(evidence, now);
			calculating.delete(nodeId);
			readinessByNodeId.set(nodeId, status);
			reasonByNodeId.set(nodeId, explainReadiness(evidence, now));
			blockedByNodeId.set(nodeId, blockedByProcessNodeIds);
			return status;
		};
		const rippleBySourceNodeId = new Map<string, ReturnType<typeof projectRipple>>();
		for (const node of nodes) {
			if (readinessFor(node.id) !== 'stale') continue;
			rippleBySourceNodeId.set(
				node.id,
				projectRipple({ nodes, edges }, node.id, {
					sourceWasGateEvidence: true,
					sourceIsMissing: true,
				}),
			);
		}
		handoff = {
			blueprintVersion: blueprint.version,
			nodes: nodes.map((node) => {
				const representationView = node.representationType
					? reprViewByType.get(node.representationType)
					: undefined;
				const gate = gatesByNodeId.get(node.id);
				return {
					processNodeId: node.id,
					capabilityKey: node.capabilityKey,
					displayName:
						termByCapability.get(node.capabilityKey) ??
						node.representationType ??
						node.capabilityKey,
					status: readinessFor(node.id),
					reason: reasonByNodeId.get(node.id) ?? 'blocked_dependency',
					blockedByProcessNodeIds: blockedByNodeId.get(node.id) ?? [],
					artistId: representationView?.assignee?.id ?? null,
					artistName: representationView?.assignee?.name ?? null,
					latestVersionId: representationView?.latestVersionId ?? null,
					gateId: gate?.id ?? null,
					gateRequired: gate?.required ?? false,
					ripple: (rippleBySourceNodeId.get(node.id) ?? []).map((impact) => {
						const target = nodeById.get(impact.nodeId);
						return {
							processNodeId: impact.nodeId,
							displayName: target
								? (termByCapability.get(target.capabilityKey) ??
									target.representationType ??
									target.capabilityKey)
								: impact.nodeId,
							severity: impact.severity,
							distance: impact.distance,
							path: impact.path,
						};
					}),
				};
			}),
		};
	}

	return {
		title: { id: title.id, name: title.name },
		timeline: { id: timeline.id, season: timeline.season, episode: timeline.episode },
		cut: { id: cut.id, number: cut.number },
		representations,
		allVersionsForDerivedFrom,
		handoff,
	};
}
