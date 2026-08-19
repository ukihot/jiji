import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deriveRelayStatus } from '$lib/core/relay';
import { registerRelay } from '$lib/server/shell/commands/register-relay';
import { getRelayStorageConnection } from '$lib/server/shell/repository/relay-repository';

function requireRelayOperator(locals: App.Locals) {
	const person = locals.currentPerson;
	if (!person) error(401, 'ログインが必要です。');
	if (person.accountType !== 'internal' || !person.relayEnabled) {
		error(403, 'このアカウントには社内Relay権限がありません。');
	}
	return person;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const person = requireRelayOperator(locals);
	const body = (await request.json()) as Record<string, unknown>;
	const titleId = body.titleId;
	const storageConnectionId = body.storageConnectionId;
	const browserInstanceId = body.browserInstanceId;
	const displayName = body.displayName;
	const allowedRootKey = body.allowedRootKey;
	const writable = body.writable;
	const lastErrorCode = body.lastErrorCode;

	if (
		typeof titleId !== 'string' ||
		typeof storageConnectionId !== 'string' ||
		typeof browserInstanceId !== 'string' ||
		typeof displayName !== 'string' ||
		typeof allowedRootKey !== 'string' ||
		typeof writable !== 'boolean' ||
		titleId.length === 0 ||
		storageConnectionId.length === 0 ||
		browserInstanceId.length === 0 ||
		displayName.trim().length === 0 ||
		allowedRootKey.trim().length === 0
	) {
		error(400, 'Relay登録内容が不正です。');
	}

	const connection = await getRelayStorageConnection(locals.db, storageConnectionId);
	if (!connection || !connection.enabled || connection.titleId !== titleId) {
		error(404, '指定されたRelayストレージ接続は利用できません。');
	}

	const relayId = await registerRelay(locals.db, {
		titleId,
		storageConnectionId,
		browserInstanceId,
		displayName: displayName.trim(),
		registeredBy: person.id,
		allowedRootKey: allowedRootKey.trim(),
		writable,
		lastErrorCode: typeof lastErrorCode === 'string' ? lastErrorCode : null,
	});

	return json({
		relayId,
		status: deriveRelayStatus({
			lastHeartbeatAt: writable ? new Date() : null,
			writable,
			now: new Date(),
		}),
	});
};
