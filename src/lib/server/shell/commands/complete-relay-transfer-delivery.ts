import { decideRelayDeliveryVerification, decideRelaySourceCleanup } from '$lib/core/relay';
import type { SqliteDb } from '../../db';
import { appendEvent } from '../repository/event-repository';
import {
	getRelayStorageConnection,
	getRelayTransferJob,
	insertRelayTransferAttempt,
	markRelaySourceDeleteRetryable,
	markRelaySourceDeleted,
	markRelayTransferJobDelivered,
	markRelayTransferJobFailed,
} from '../repository/relay-repository';
import { deleteRelayObject, headRelayObject } from '../relay-object-storage';

export interface CompleteRelayTransferDeliveryInput {
	jobId: string;
	relayId: string;
	leaseToken: string;
	actualSize: number;
	actualSha256: string;
}

export type CompleteRelayTransferDeliveryResult =
	| { ok: true; sourceDeleted: boolean }
	| {
			ok: false;
			error: 'not_found' | 'not_leased_by_this_relay' | 'size_mismatch' | 'sha256_mismatch';
	  };

/**
 * design.md 9.6.5の7〜10、9.6.6の削除再試行。社内共有フォルダへ確定・再読込済みの
 * 値でだけ配送成功を判定し、成功後にobject storageからの削除まで一気に確認する
 * （このRelayの発見モデルでは1 job = 1 objectなので、fan-out待ちは常に自明に揃う）。
 */
export async function completeRelayTransferDelivery(
	db: SqliteDb,
	input: CompleteRelayTransferDeliveryInput,
): Promise<CompleteRelayTransferDeliveryResult> {
	const job = await getRelayTransferJob(db, input.jobId);
	if (!job) return { ok: false, error: 'not_found' };
	if (job.leasedRelayId !== input.relayId) return { ok: false, error: 'not_leased_by_this_relay' };

	const decision = decideRelayDeliveryVerification({
		expectedSize: job.expectedSize,
		expectedSha256: job.expectedSha256,
		actualSize: input.actualSize,
		actualSha256: input.actualSha256,
	});

	const now = new Date();
	if (!decision.ok) {
		await db.transaction(async (tx) => {
			await markRelayTransferJobFailed(tx, job.id);
			await insertRelayTransferAttempt(tx, {
				id: crypto.randomUUID(),
				jobId: job.id,
				relayId: input.relayId,
				leaseToken: input.leaseToken,
				result: 'terminal_error',
				actualSize: input.actualSize,
				actualSha256: input.actualSha256,
				errorCode: decision.reason,
				createdAt: now,
			});
			await appendEvent(
				tx,
				'relay_transfer_job',
				job.id,
				{ type: 'RelayTransferDeliveryRejected', payload: { reason: decision.reason } },
				now,
			);
		});
		return { ok: false, error: decision.reason };
	}

	await db.transaction(async (tx) => {
		await markRelayTransferJobDelivered(tx, job.id, {
			deliveredSize: input.actualSize,
			deliveredSha256: input.actualSha256,
			sharedFolderVerifiedAt: now,
		});
		await insertRelayTransferAttempt(tx, {
			id: crypto.randomUUID(),
			jobId: job.id,
			relayId: input.relayId,
			leaseToken: input.leaseToken,
			result: 'delivered',
			actualSize: input.actualSize,
			actualSha256: input.actualSha256,
			errorCode: null,
			createdAt: now,
		});
		await appendEvent(
			tx,
			'relay_transfer_job',
			job.id,
			{
				type: 'RelayTransferDelivered',
				payload: { actualSize: input.actualSize, actualSha256: input.actualSha256 },
			},
			now,
		);
	});

	const cleanup = decideRelaySourceCleanup({
		deliveries: [
			{
				state: 'delivered',
				expectedSize: job.expectedSize,
				expectedSha256: job.expectedSha256 ?? input.actualSha256,
				deliveredSize: input.actualSize,
				deliveredSha256: input.actualSha256,
			},
		],
		sourceDeleteState: 'pending',
	});
	if (cleanup.action !== 'delete_source_object') return { ok: true, sourceDeleted: false };

	const connection = await getRelayStorageConnection(db, job.storageConnectionId);
	if (!connection) return { ok: true, sourceDeleted: false };

	try {
		await deleteRelayObject(connection, job.sourceObjectKey);
		await db.transaction(async (tx) => {
			await markRelaySourceDeleted(tx, job.id);
			await appendEvent(
				tx,
				'relay_transfer_job',
				job.id,
				{ type: 'RelaySourceDeleted', payload: { sourceObjectKey: job.sourceObjectKey } },
				new Date(),
			);
		});
		return { ok: true, sourceDeleted: true };
	} catch (error) {
		// 削除失敗時はHEADで存在確認してから再試行させる（design.md 9.6.6）。既に無ければ成功扱い。
		const stillExists = await headRelayObject(connection, job.sourceObjectKey).catch(() => true);
		if (!stillExists) {
			await db.transaction(async (tx) => {
				await markRelaySourceDeleted(tx, job.id);
				await appendEvent(
					tx,
					'relay_transfer_job',
					job.id,
					{ type: 'RelaySourceDeleted', payload: { sourceObjectKey: job.sourceObjectKey } },
					new Date(),
				);
			});
			return { ok: true, sourceDeleted: true };
		}
		await markRelaySourceDeleteRetryable(
			db,
			job.id,
			error instanceof Error ? error.message : 'delete_failed',
			job.sourceDeleteRetryCount + 1,
		);
		return { ok: true, sourceDeleted: false };
	}
}
