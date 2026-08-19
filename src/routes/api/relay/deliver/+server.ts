import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { completeRelayTransferDelivery } from '$lib/server/shell/commands/complete-relay-transfer-delivery';
import { getRelayRegistration } from '$lib/server/shell/repository/relay-repository';

/**
 * Relayブラウザが社内共有フォルダへ書込み・再読込して得たsize/sha256だけを受け取る
 * （design.md 9.6.5の7〜10）。検証成功なら、同じリクエストの中でobject storageの削除まで行う。
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const person = locals.currentPerson;
	if (!person) error(401, 'ログインが必要です。');
	if (person.accountType !== 'internal' || !person.relayEnabled) {
		error(403, 'このアカウントには社内Relay権限がありません。');
	}

	const body = (await request.json()) as Record<string, unknown>;
	const { jobId, relayId, leaseToken, actualSize, actualSha256 } = body;
	if (
		typeof jobId !== 'string' ||
		typeof relayId !== 'string' ||
		typeof leaseToken !== 'string' ||
		typeof actualSize !== 'number' ||
		typeof actualSha256 !== 'string' ||
		jobId.length === 0 ||
		relayId.length === 0
	) {
		error(400, '配送完了報告の内容が不正です。');
	}

	const relay = await getRelayRegistration(locals.db, relayId);
	if (!relay || relay.registeredBy !== person.id) error(404, 'Relayが見つかりません。');

	const result = await completeRelayTransferDelivery(locals.db, {
		jobId,
		relayId,
		leaseToken,
		actualSize,
		actualSha256,
	});
	if (!result.ok) {
		const status = result.error === 'not_found' ? 404 : 409;
		error(status, `配送の検証に失敗しました（${result.error}）。`);
	}
	return json(result);
};
