import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { claimRelayTransferJobs } from '$lib/server/shell/commands/claim-relay-transfer-jobs';
import {
	getRelayRegistration,
	getRelayStorageConnection,
} from '$lib/server/shell/repository/relay-repository';
import {
	RelayObjectStorageCredentialsMissingError,
	RelayObjectStorageUnsupportedError,
} from '$lib/server/shell/relay-object-storage';

/**
 * 「今すぐ取得」の起点。登録済みbucket/prefixをlist scanして未知のobjectをjob化し、
 * このRelayへclaimできたjobを短寿命ダウンロードURLとともに返す（design.md 9.6.5の3〜5）。
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const person = locals.currentPerson;
	if (!person) error(401, 'ログインが必要です。');
	if (person.accountType !== 'internal' || !person.relayEnabled) {
		error(403, 'このアカウントには社内Relay権限がありません。');
	}

	const body = (await request.json()) as Record<string, unknown>;
	const relayId = body.relayId;
	if (typeof relayId !== 'string' || relayId.length === 0) {
		error(400, 'relayIdが不正です。');
	}

	const relay = await getRelayRegistration(locals.db, relayId);
	if (!relay || relay.registeredBy !== person.id) error(404, 'Relayが見つかりません。');

	const connection = await getRelayStorageConnection(locals.db, relay.storageConnectionId);
	if (!connection || !connection.enabled) {
		error(404, '指定されたRelay転送待ちストレージは利用できません。');
	}

	try {
		const jobs = await claimRelayTransferJobs(locals.db, connection, {
			relayId: relay.id,
			titleId: relay.titleId,
		});
		return json({ jobs });
	} catch (err) {
		if (err instanceof RelayObjectStorageUnsupportedError) error(400, err.message);
		if (err instanceof RelayObjectStorageCredentialsMissingError) error(400, err.message);
		error(502, err instanceof Error ? err.message : 'Object Storageへの接続に失敗しました。');
	}
};
