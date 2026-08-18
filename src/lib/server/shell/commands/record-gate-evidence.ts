import { computeEventHash } from '$lib/core/event-hash';
import type { SqliteDb } from '../../db';
import { appendEvent } from '../repository/event-repository';
import {
	getGateEvidenceContext,
	getVersion,
	insertGateEvidence,
} from '../repository/production-repository';

export type GateEvidenceResult =
	| { ok: true; evidenceId: string }
	| { ok: false; error: 'gate_or_version_not_found' | 'version_outside_cut_or_process' };

/**
 * ある版をどの工程ゲートで確認したかを、版内容のハッシュとともに追記する。
 * Reviewのコメント履歴とは別に、後続工程を開始できる根拠だけを正規化して保持する。
 */
export async function recordGateEvidence(
	db: SqliteDb,
	input: {
		titleId: string;
		cutId: string;
		gateId: string;
		versionId: string;
		reviewerId: string;
		result: 'passed' | 'returned';
	},
): Promise<GateEvidenceResult> {
	const now = new Date();
	const evidenceId = crypto.randomUUID();

	return db.transaction(async (tx): Promise<GateEvidenceResult> => {
		const [context, version] = await Promise.all([
			getGateEvidenceContext(tx, input.gateId, input.versionId),
			getVersion(tx, input.versionId),
		]);
		if (!context || !version) return { ok: false, error: 'gate_or_version_not_found' };
		if (context.cutId !== input.cutId || context.titleId !== input.titleId) {
			return { ok: false, error: 'version_outside_cut_or_process' };
		}

		const versionHash = computeEventHash(null, {
			type: 'VersionContent',
			payload: {
				fileRef: version.fileRef,
				artifactMetadata: version.artifactMetadata,
				derivedFromVersionId: version.derivedFromVersionId,
				derivedFromRelation: version.derivedFromRelation,
			},
			createdAt: version.createdAt,
		});
		await appendEvent(
			tx,
			'cut',
			input.cutId,
			{
				type: 'GateEvidenceRecorded',
				payload: {
					evidenceId,
					gateId: input.gateId,
					versionId: input.versionId,
					versionHash,
					result: input.result,
					reviewerId: input.reviewerId,
				},
			},
			now,
		);
		await insertGateEvidence(tx, {
			id: evidenceId,
			gateId: input.gateId,
			versionId: input.versionId,
			versionHash,
			reviewerId: input.reviewerId,
			result: input.result,
			recordedAt: now,
		});

		return { ok: true, evidenceId };
	});
}
