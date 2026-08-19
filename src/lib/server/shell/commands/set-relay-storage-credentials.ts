import type { SqliteDb } from '../../db';
import { appendEvent } from '../repository/event-repository';
import {
	getRelayStorageConnection,
	updateRelayStorageCredentials,
} from '../repository/relay-repository';

export interface SetRelayStorageCredentialsInput {
	connectionId: string;
	titleId: string;
	accessKeyId: string;
	secretAccessKey: string;
	updatedBy: string;
}

export type SetRelayStorageCredentialsResult =
	| { ok: true }
	| { ok: false; error: 'not_found' | 'access_key_id_required' | 'secret_access_key_required' };

/**
 * 既存のRelay Storage接続へAccess Key ID / Secret Access Keyを後付けで設定・更新する。
 * 鍵の値そのものは監査イベントのpayloadへ含めない（設定した事実だけを記録する）。
 */
export async function setRelayStorageCredentials(
	db: SqliteDb,
	input: SetRelayStorageCredentialsInput,
): Promise<SetRelayStorageCredentialsResult> {
	const accessKeyId = input.accessKeyId.trim();
	const secretAccessKey = input.secretAccessKey.trim();
	if (accessKeyId.length === 0) return { ok: false, error: 'access_key_id_required' };
	if (secretAccessKey.length === 0) return { ok: false, error: 'secret_access_key_required' };

	const connection = await getRelayStorageConnection(db, input.connectionId);
	if (!connection || connection.titleId !== input.titleId) return { ok: false, error: 'not_found' };

	const now = new Date();
	await db.transaction(async (tx) => {
		await updateRelayStorageCredentials(tx, input.connectionId, accessKeyId, secretAccessKey);
		await appendEvent(
			tx,
			'title',
			input.titleId,
			{
				type: 'RelayStorageCredentialsUpdated',
				payload: { connectionId: input.connectionId, updatedBy: input.updatedBy },
			},
			now,
		);
	});

	return { ok: true };
}
