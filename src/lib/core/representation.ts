/**
 * design.md 4.0.2節/6.1節/6.2節: Representation（Cutが工程を経て取る表現形態）と、
 * その配下のSubmission/Version/Review/Sealのdecide/evolve。
 *
 * 設計メモ: design.md 3章はrepresentation.ts/version.tsを別ファイルとして列挙しているが、
 * 実装済みのtimeline.ts（Title/Timeline/Cutを1ファイルに統合）と同じ理由で、
 * ここでもRepresentation/Submission/Version/Review/Sealを1つのCutの生産物ライフサイクルとして
 * 1ファイルにまとめる。イベントは 'cut' + cutId のストリームに追記する（CutAddedが
 * 'timeline' + timelineIdストリームに乗るのと同じ「親コンテナ単位でまとめる」流儀）。
 *
 * Submission/Versionは常にペアで生成される（内容の無い提出は存在しない）ため、
 * SubmitVersionコマンド1つがVersionSubmittedイベント1つを生む。物理テーブルは
 * design.md通りsubmission/versionの2枚に分けるが、Shellがそのイベント1つから
 * 2行をINSERTする（insertCutがCutAdded 1つからtimeline_item/cutの2行を作るのと同型）。
 *
 * Review と Seal は明確に別物として扱う（design.md 6.2節）。Reviewは「担当者の判断」で
 * 何度でも起こりうるが、作品に採用される版を確定させる事実（＝Latest ≠ Approved の
 * Approved側）はSealだけが持つ。ReviewSubmittedはrepresentation_current_versionの
 * approved_version_idを一切更新しない。更新するのはVersionSealedだけ。
 */

export type RepresentationType =
	| 'storyboard'
	| 'animatic'
	| 'layout'
	| 'animation'
	| 'bg'
	| 'cg_render'
	| 'composite'
	| 'final';

/**
 * design.md 4.4節の表の並び順そのもの。decideが新規Representation作成時のsort_orderに使うほか、
 * Shell/UI層がCut Evolution Viewer（design.md 7.5節）で全8種を固定順に描画する際にも使う。
 */
export const REPRESENTATION_TYPES: readonly RepresentationType[] = [
	'storyboard',
	'animatic',
	'layout',
	'animation',
	'bg',
	'cg_render',
	'composite',
	'final',
];

export function isRepresentationType(value: unknown): value is RepresentationType {
	return typeof value === 'string' && (REPRESENTATION_TYPES as readonly string[]).includes(value);
}

export type ReviewResult = 'approved' | 'returned';

export const REVIEW_RESULTS: readonly ReviewResult[] = ['approved', 'returned'];

export function isReviewResult(value: unknown): value is ReviewResult {
	return typeof value === 'string' && (REVIEW_RESULTS as readonly string[]).includes(value);
}

/**
 * あるVersionが、Cut内の別のVersion（別Representationのこともある）から派生したという
 * 因果関係。「Animationという新しいファイルが突然出現した」のではなく「Layout v5から
 * 作画した」という制作現場の実態を残す。
 */
export type DerivedFromRelation = 'refined' | 'converted' | 'replaced';

export const DERIVED_FROM_RELATIONS: readonly DerivedFromRelation[] = [
	'refined',
	'converted',
	'replaced',
];

export function isDerivedFromRelation(value: unknown): value is DerivedFromRelation {
	return typeof value === 'string' && (DERIVED_FROM_RELATIONS as readonly string[]).includes(value);
}

export interface DerivedFromRef {
	versionId: string;
	relation: DerivedFromRelation;
}

export type RepresentationEvent =
	| {
			type: 'RepresentationCreated';
			payload: {
				representationId: string;
				cutId: string;
				representationType: RepresentationType;
				sortOrder: number;
			};
	  }
	| {
			type: 'VersionSubmitted';
			payload: {
				representationId: string;
				representationType: RepresentationType;
				cutId: string;
				submissionId: string;
				versionId: string;
				seq: number;
				processStep: string;
				fileRef: string;
				proxyRef: string | null;
				/** EXR AOV/PSDレイヤー/PNGのアルファ有無等、成果物形式ごとの内部構造メタデータ（F-25） */
				artifactMetadata: Record<string, unknown> | null;
				derivedFrom: DerivedFromRef | null;
				submittedBy: string;
				submittedAt: string; // ISO
			};
	  }
	| {
			type: 'ReviewSubmitted';
			payload: {
				reviewId: string;
				versionId: string;
				reviewerId: string;
				result: ReviewResult;
				comment: string | null;
				reviewedAt: string; // ISO
			};
	  }
	| {
			type: 'VersionSealed';
			payload: {
				sealId: string;
				versionId: string;
				representationId: string;
				hash: string;
				sealedBy: string;
				sealedAt: string; // ISO
			};
	  };

export type RepresentationCommand =
	| {
			type: 'SubmitVersion';
			cutId: string;
			representationType: RepresentationType;
			/** Shellが事前生成する候補id。該当typeのRepresentationが既存ならdecideはこれを使わず既存idを使う */
			representationIdIfNew: string;
			submissionId: string;
			versionId: string;
			processStep: string;
			fileRef: string;
			proxyRef: string | null;
			artifactMetadata: Record<string, unknown> | null;
			derivedFrom: DerivedFromRef | null;
			submittedBy: string;
	  }
	| {
			type: 'SubmitReview';
			reviewId: string;
			versionId: string;
			reviewerId: string;
			result: ReviewResult;
			comment: string | null;
	  }
	| {
			type: 'SealVersion';
			sealId: string;
			versionId: string;
			representationId: string;
			/** Shellが計算して渡す版の内容ハッシュ（lib/core/event-hash.tsのcomputeEventHashを流用） */
			hash: string;
			sealedBy: string;
	  };

export type RepresentationError =
	| { kind: 'blank_file_ref' }
	/** SubmitReview/SealVersionの対象versionIdが、このCutのこれまでのVersionSubmittedイベントに存在しない */
	| { kind: 'version_not_found' }
	/** SubmitVersionのderivedFrom.versionIdが、このCutのこれまでのVersionSubmittedイベントに存在しない */
	| { kind: 'derived_from_version_not_found' };

export type RepresentationDecideResult =
	| { ok: true; events: RepresentationEvent[] }
	| { ok: false; error: RepresentationError };

export interface RepresentationInfo {
	representationId: string;
	representationType: RepresentationType;
	sortOrder: number;
	versionCount: number;
	latestVersionId: string | null;
}

/** 1つのCutの生産物ライフサイクル全体（'cut'+cutIdストリームのevolve結果） */
export interface CutProductionState {
	representationsByType: ReadonlyMap<RepresentationType, RepresentationInfo>;
	knownVersionIds: ReadonlySet<string>;
}

export function evolveRepresentation(events: readonly RepresentationEvent[]): CutProductionState {
	const representationsByType = new Map<RepresentationType, RepresentationInfo>();
	const knownVersionIds = new Set<string>();
	for (const event of events) {
		if (event.type === 'RepresentationCreated') {
			representationsByType.set(event.payload.representationType, {
				representationId: event.payload.representationId,
				representationType: event.payload.representationType,
				sortOrder: event.payload.sortOrder,
				versionCount: 0,
				latestVersionId: null,
			});
		} else if (event.type === 'VersionSubmitted') {
			const info = representationsByType.get(event.payload.representationType);
			if (info) {
				representationsByType.set(event.payload.representationType, {
					...info,
					versionCount: info.versionCount + 1,
					latestVersionId: event.payload.versionId,
				});
			}
			knownVersionIds.add(event.payload.versionId);
		}
		// ReviewSubmitted/VersionSealedはdecideの重複チェック・採番・既知バージョン集合を変えないため、
		// evolveの状態には反映しない（knownVersionIdsはVersionSubmittedの時点で既に入っている）。
	}
	return { representationsByType, knownVersionIds };
}

export interface RepresentationContext {
	now: Date;
}

export function decideRepresentation(
	command: RepresentationCommand,
	state: CutProductionState,
	context: RepresentationContext,
): RepresentationDecideResult {
	switch (command.type) {
		case 'SubmitVersion': {
			if (command.fileRef.trim().length === 0) {
				return { ok: false, error: { kind: 'blank_file_ref' } };
			}
			if (command.derivedFrom && !state.knownVersionIds.has(command.derivedFrom.versionId)) {
				return { ok: false, error: { kind: 'derived_from_version_not_found' } };
			}

			const events: RepresentationEvent[] = [];
			const existing = state.representationsByType.get(command.representationType);

			const representationId = existing ? existing.representationId : command.representationIdIfNew;
			const seq = existing ? existing.versionCount + 1 : 1;

			if (!existing) {
				events.push({
					type: 'RepresentationCreated',
					payload: {
						representationId,
						cutId: command.cutId,
						representationType: command.representationType,
						sortOrder: REPRESENTATION_TYPES.indexOf(command.representationType),
					},
				});
			}

			events.push({
				type: 'VersionSubmitted',
				payload: {
					representationId,
					representationType: command.representationType,
					cutId: command.cutId,
					submissionId: command.submissionId,
					versionId: command.versionId,
					seq,
					processStep: command.processStep,
					fileRef: command.fileRef,
					proxyRef: command.proxyRef,
					artifactMetadata: command.artifactMetadata,
					derivedFrom: command.derivedFrom,
					submittedBy: command.submittedBy,
					submittedAt: context.now.toISOString(),
				},
			});

			return { ok: true, events };
		}

		case 'SubmitReview': {
			if (!state.knownVersionIds.has(command.versionId)) {
				return { ok: false, error: { kind: 'version_not_found' } };
			}
			return {
				ok: true,
				events: [
					{
						type: 'ReviewSubmitted',
						payload: {
							reviewId: command.reviewId,
							versionId: command.versionId,
							reviewerId: command.reviewerId,
							result: command.result,
							comment: command.comment,
							reviewedAt: context.now.toISOString(),
						},
					},
				],
			};
		}

		case 'SealVersion': {
			if (!state.knownVersionIds.has(command.versionId)) {
				return { ok: false, error: { kind: 'version_not_found' } };
			}
			return {
				ok: true,
				events: [
					{
						type: 'VersionSealed',
						payload: {
							sealId: command.sealId,
							versionId: command.versionId,
							representationId: command.representationId,
							hash: command.hash,
							sealedBy: command.sealedBy,
							sealedAt: context.now.toISOString(),
						},
					},
				],
			};
		}
	}
}
