import { deriveRelayTargetRelativePath } from '$lib/core/relay';
import type { SqliteDb } from '../../db';
import { appendEvent } from '../repository/event-repository';
import {
	getRelayTransferJobBySourceKey,
	insertRelayTransferAttempt,
	insertRelayTransferJob,
	listClaimableRelayTransferJobs,
	markRelayTransferJobLeased,
	type RelayStorageConnectionRow,
} from '../repository/relay-repository';
import { listRelayStorageObjects, presignRelayObjectDownload } from '../relay-object-storage';

const LEASE_DURATION_MS = 5 * 60_000;
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

export interface ClaimRelayTransferJobsInput {
	relayId: string;
	titleId: string;
}

export interface ClaimedRelayTransferJob {
	jobId: string;
	leaseToken: string;
	targetRelativePath: string;
	expectedSize: number;
	downloadUrl: string;
}

/**
 * design.md 9.6.5の3〜5に相当。Submission機能がまだ無いため、出稿がjobを作る代わりに
 * 接続済みbucket/prefix配下を直接list scanし、未知のobjectをpending jobとして発見する。
 * その上でこのRelayへ貸し出せるjob（pending、またはlease切れ）をclaimし、
 * 短寿命のダウンロードURLを添えて返す。
 */
export async function claimRelayTransferJobs(
	db: SqliteDb,
	connection: RelayStorageConnectionRow,
	input: ClaimRelayTransferJobsInput,
): Promise<ClaimedRelayTransferJob[]> {
	const now = new Date();

	const objects = await listRelayStorageObjects(connection, connection.prefix);
	for (const object of objects) {
		const targetRelativePath = deriveRelayTargetRelativePath(object.key, connection.prefix);
		if (!targetRelativePath) continue; // ディレクトリマーカーやprefix脱出は対象外
		const existing = await getRelayTransferJobBySourceKey(db, connection.id, object.key);
		if (existing) continue;
		await db.transaction(async (tx) => {
			const jobId = crypto.randomUUID();
			await insertRelayTransferJob(tx, {
				id: jobId,
				titleId: connection.titleId,
				storageConnectionId: connection.id,
				sourceObjectKey: object.key,
				targetRelativePath,
				expectedSize: object.size,
				expectedSha256: null,
				createdAt: now,
			});
			await appendEvent(
				tx,
				'relay_transfer_job',
				jobId,
				{
					type: 'RelayTransferJobDiscovered',
					payload: {
						titleId: connection.titleId,
						storageConnectionId: connection.id,
						sourceObjectKey: object.key,
						targetRelativePath,
						expectedSize: object.size,
					},
				},
				now,
			);
		});
	}

	const claimable = await listClaimableRelayTransferJobs(db, connection.id, now);
	const claimed: ClaimedRelayTransferJob[] = [];
	for (const job of claimable) {
		const leaseToken = crypto.randomUUID();
		const leaseUntil = new Date(now.getTime() + LEASE_DURATION_MS);
		await db.transaction(async (tx) => {
			await markRelayTransferJobLeased(tx, job.id, input.relayId, leaseUntil);
			await insertRelayTransferAttempt(tx, {
				id: crypto.randomUUID(),
				jobId: job.id,
				relayId: input.relayId,
				leaseToken,
				result: 'started',
				actualSize: null,
				actualSha256: null,
				errorCode: null,
				createdAt: now,
			});
			await appendEvent(
				tx,
				'relay_transfer_job',
				job.id,
				{ type: 'RelayTransferJobLeased', payload: { relayId: input.relayId, leaseToken } },
				now,
			);
		});
		const downloadUrl = await presignRelayObjectDownload(
			connection,
			job.sourceObjectKey,
			DOWNLOAD_URL_TTL_SECONDS,
		);
		claimed.push({
			jobId: job.id,
			leaseToken,
			targetRelativePath: job.targetRelativePath,
			expectedSize: job.expectedSize,
			downloadUrl,
		});
	}
	return claimed;
}
