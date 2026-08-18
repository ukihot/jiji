import {
	REPRESENTATION_TYPES,
	decideRepresentation,
	evolveRepresentation,
	type RepresentationError,
	type RepresentationEvent,
} from '$lib/core/representation';
import { computeEventHash } from '$lib/core/event-hash';
import { projectRepresentationCurrentVersion } from '$lib/core/projections/representation-current-version';
import type { SqliteDb } from '../../db';
import { appendEvents, getEventsByTarget } from '../repository/event-repository';
import {
	buildProcessStatus,
	getRepresentationCurrentVersion,
	getVersion,
	insertSeal,
	listRepresentationCurrentVersionsByCut,
	upsertRepresentationCurrentVersion,
} from '../repository/production-repository';
import { updateBandViewProcessStatus } from '../repository/timeline-repository';

export interface SealVersionInput {
	cutId: string;
	representationId: string;
	versionId: string;
	sealedBy: string;
}

export type SealVersionResult =
	| { ok: true; sealId: string; hash: string }
	| { ok: false; error: RepresentationError | { kind: 'version_row_not_found' } };

/**
 * design.md 6.2節: 「その版を採用した」という事実を記録する。Reviewとは別の行為であり、
 * representation_current_version.approved_version_idを更新できるのはこのコマンドだけ
 * （representation.tsファイル冒頭コメント参照）。要件定義8.2節: admin権限のみが実行できる
 * （呼び出し元のルートで`canWorkspaceRole(..., 'manageProduction')`を確認してから呼ぶこと。ここではドメイン
 * 不変条件のみを見る）。
 */
export async function sealVersion(
	db: SqliteDb,
	input: SealVersionInput,
): Promise<SealVersionResult> {
	const sealId = crypto.randomUUID();
	const now = new Date();

	return db.transaction(async (tx): Promise<SealVersionResult> => {
		const versionRow = await getVersion(tx, input.versionId);
		if (!versionRow) return { ok: false, error: { kind: 'version_row_not_found' } };

		// design.md 6.2節: 版の内容（file_ref/artifact_metadata/derived_from）をハッシュ化する。
		// 実ファイルバイト列へのアクセス（ffmpeg等）は範囲外のため、Jijiが保持するメタデータのハッシュとする。
		const hash = computeEventHash(null, {
			type: 'VersionContent',
			payload: {
				fileRef: versionRow.fileRef,
				artifactMetadata: versionRow.artifactMetadata,
				derivedFromVersionId: versionRow.derivedFromVersionId,
				derivedFromRelation: versionRow.derivedFromRelation,
			},
			createdAt: versionRow.createdAt,
		});

		const rawEvents = await getEventsByTarget(tx, 'cut', input.cutId);
		const events = rawEvents.map((row) => row as unknown as RepresentationEvent);
		const state = evolveRepresentation(events);

		const decision = decideRepresentation(
			{
				type: 'SealVersion',
				sealId,
				versionId: input.versionId,
				representationId: input.representationId,
				hash,
				sealedBy: input.sealedBy,
			},
			state,
			// SealVersionのdecideはenabledTypesを参照しないのでダミー値でよい（submit-review.tsと同じ扱い）
			{ now, enabledTypes: new Set(REPRESENTATION_TYPES) },
		);
		if (!decision.ok) return { ok: false, error: decision.error };

		await appendEvents(tx, 'cut', input.cutId, decision.events, now);
		await insertSeal(tx, {
			id: sealId,
			versionId: input.versionId,
			hash,
			sealedBy: input.sealedBy,
			sealedAt: now,
		});

		const sealedEvent = decision.events[0] as Extract<
			RepresentationEvent,
			{ type: 'VersionSealed' }
		>;
		const currentProjection = await getRepresentationCurrentVersion(tx, input.representationId);
		const nextProjection = projectRepresentationCurrentVersion(sealedEvent, currentProjection);
		if (nextProjection) {
			await upsertRepresentationCurrentVersion(tx, nextProjection);
		}

		// design.md 4.1節: timeline_band_view.process_statusのapprovedVersionIdもここで更新する
		const currentVersions = await listRepresentationCurrentVersionsByCut(tx, input.cutId);
		await updateBandViewProcessStatus(tx, input.cutId, buildProcessStatus(currentVersions));

		return { ok: true, sealId, hash };
	});
}
