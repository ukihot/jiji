import {
	applyRepresentationTypesDefault,
	decideRepresentation,
	evolveRepresentation,
	type DerivedFromRef,
	type RepresentationError,
	type RepresentationEvent,
	type RepresentationType,
} from '$lib/core/representation';
import { projectRepresentationCurrentVersion } from '$lib/core/projections/representation-current-version';
import type { SqliteDb } from '../../db';
import { appendEvents, getEventsByTarget } from '../repository/event-repository';
import {
	buildProcessStatus,
	getRepresentationCurrentVersion,
	insertRepresentation,
	insertSubmission,
	insertVersion,
	listEnabledRepresentationTypes,
	listRepresentationCurrentVersionsByCut,
	upsertRepresentationCurrentVersion,
} from '../repository/production-repository';
import { updateBandViewProcessStatus } from '../repository/timeline-repository';

export interface SubmitVersionInput {
	/** design.md 4.0.2節改訂: そのTitleで有効なRepresentation種別を確認するために要る */
	titleId: string;
	cutId: string;
	representationType: RepresentationType;
	processStep: string;
	fileRef: string;
	proxyRef: string | null;
	artifactMetadata: Record<string, unknown> | null;
	derivedFrom: DerivedFromRef | null;
	submittedBy: string;
}

export type SubmitVersionResult =
	| { ok: true; representationId: string; submissionId: string; versionId: string }
	| { ok: false; error: RepresentationError };

/**
 * design.md 4.0.2節/7.5節: Cut Evolution Viewerからの「バージョンを提出する」。
 * 対象Representationが無ければ暗黙に作成し（P-06: 事前のセットアップ手順を要求しない）、
 * Submission+Versionを対で作る（representation.tsのファイル冒頭コメント参照）。
 */
export async function submitVersion(
	db: SqliteDb,
	input: SubmitVersionInput,
): Promise<SubmitVersionResult> {
	const representationIdIfNew = crypto.randomUUID();
	const submissionId = crypto.randomUUID();
	const versionId = crypto.randomUUID();
	const now = new Date();

	return db.transaction(async (tx): Promise<SubmitVersionResult> => {
		// design.md 2.2節: Shellがそのcutのイベント列を取得し、Coreがevolveで現在状態を作る
		const rawEvents = await getEventsByTarget(tx, 'cut', input.cutId);
		const events = rawEvents.map((row) => row as unknown as RepresentationEvent);
		const state = evolveRepresentation(events);

		// design.md 4.0.2節改訂: プロジェクト設定で有効化されたRepresentation種別のみ提出を許す
		const configuredTypes = await listEnabledRepresentationTypes(tx, input.titleId);
		const enabledTypes = applyRepresentationTypesDefault(configuredTypes);

		const decision = decideRepresentation(
			{
				type: 'SubmitVersion',
				cutId: input.cutId,
				representationType: input.representationType,
				representationIdIfNew,
				submissionId,
				versionId,
				processStep: input.processStep,
				fileRef: input.fileRef,
				proxyRef: input.proxyRef,
				artifactMetadata: input.artifactMetadata,
				derivedFrom: input.derivedFrom,
				submittedBy: input.submittedBy,
			},
			state,
			{ now, enabledTypes },
		);
		if (!decision.ok) return { ok: false, error: decision.error };

		await appendEvents(tx, 'cut', input.cutId, decision.events, now);

		const representationCreatedEvent = decision.events.find(
			(event): event is Extract<RepresentationEvent, { type: 'RepresentationCreated' }> =>
				event.type === 'RepresentationCreated',
		);
		const versionSubmittedEvent = decision.events.find(
			(event): event is Extract<RepresentationEvent, { type: 'VersionSubmitted' }> =>
				event.type === 'VersionSubmitted',
		);
		if (!versionSubmittedEvent) {
			// decideRepresentationのSubmitVersion分岐は必ずVersionSubmittedを1つ含む（representation.ts参照）
			throw new Error('SubmitVersion decision produced no VersionSubmitted event');
		}
		const representationId = versionSubmittedEvent.payload.representationId;

		if (representationCreatedEvent) {
			await insertRepresentation(tx, {
				id: representationCreatedEvent.payload.representationId,
				cutId: input.cutId,
				type: representationCreatedEvent.payload.representationType,
				sortOrder: representationCreatedEvent.payload.sortOrder,
			});
		}

		await insertSubmission(tx, {
			id: submissionId,
			cutId: input.cutId,
			representationId,
			processStep: input.processStep,
			submittedBy: input.submittedBy,
			submittedAt: now,
		});
		await insertVersion(tx, {
			id: versionId,
			submissionId,
			seq: versionSubmittedEvent.payload.seq,
			fileRef: input.fileRef,
			proxyRef: input.proxyRef,
			artifactMetadata: input.artifactMetadata,
			derivedFromVersionId: input.derivedFrom?.versionId ?? null,
			derivedFromRelation: input.derivedFrom?.relation ?? null,
			createdAt: now,
		});

		// design.md 4.1節: representation_current_version投影を更新
		const currentProjection = await getRepresentationCurrentVersion(tx, representationId);
		const nextProjection = projectRepresentationCurrentVersion(
			versionSubmittedEvent,
			currentProjection,
		);
		if (nextProjection) {
			await upsertRepresentationCurrentVersion(tx, nextProjection);
		}

		// design.md 4.1節: timeline_band_view.process_statusをこのCut分だけ更新（帯全体のオフセット計算は不要）
		const currentVersions = await listRepresentationCurrentVersionsByCut(tx, input.cutId);
		await updateBandViewProcessStatus(tx, input.cutId, buildProcessStatus(currentVersions));

		return { ok: true, representationId, submissionId, versionId };
	});
}
