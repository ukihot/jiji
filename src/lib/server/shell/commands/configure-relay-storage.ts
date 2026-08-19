import { validateRelayStorageConfig, type RelayStorageConfigInput } from '$lib/core/relay';
import type { SqliteDb } from '../../db';
import { appendEvent } from '../repository/event-repository';
import {
	insertRelayStorageConnection,
	type RelayStorageConnectionRow,
} from '../repository/relay-repository';

export interface ConfigureRelayStorageInput extends RelayStorageConfigInput {
	titleId: string;
	region: string | null;
	configuredBy: string;
	/** 初回登録時にまとめて入力された場合だけ入る。無ければ後から資格情報だけを更新する。 */
	accessKeyId: string | null;
	secretAccessKey: string | null;
}

export type ConfigureRelayStorageResult =
	| { ok: true; connection: RelayStorageConnectionRow }
	| { ok: false; error: string };

/** Access Key ID / Secret Access Keyはサーバー側にだけ保存し、監査イベントのpayloadには含めない。 */
export async function configureRelayStorage(
	db: SqliteDb,
	input: ConfigureRelayStorageInput,
): Promise<ConfigureRelayStorageResult> {
	const error = validateRelayStorageConfig(input);
	if (error) return { ok: false, error };

	const now = new Date();
	const connection: RelayStorageConnectionRow = {
		id: crypto.randomUUID(),
		titleId: input.titleId,
		provider: input.provider,
		endpoint: input.endpoint?.trim() || null,
		region: input.region?.trim() || null,
		bucketOrContainer: input.bucketOrContainer.trim(),
		prefix: input.prefix.trim().replace(/^\/+|\/+$/g, ''),
		authRef: input.authRef.trim(),
		accessKeyId: input.accessKeyId?.trim() || null,
		secretAccessKey: input.secretAccessKey?.trim() || null,
		enabled: true,
		createdBy: input.configuredBy,
		createdAt: now,
	};

	await db.transaction(async (tx) => {
		await appendEvent(
			tx,
			'title',
			input.titleId,
			{
				type: 'RelayStorageConfigured',
				payload: {
					connectionId: connection.id,
					provider: connection.provider,
					bucketOrContainer: connection.bucketOrContainer,
					prefix: connection.prefix,
				},
			},
			now,
		);
		await insertRelayStorageConnection(tx, connection);
	});

	return { ok: true, connection };
}
