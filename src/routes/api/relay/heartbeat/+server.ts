import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deriveRelayStatus } from '$lib/core/relay';
import {
	getRelayRegistration,
	updateRelayRegistration,
} from '$lib/server/shell/repository/relay-repository';

export const POST: RequestHandler = async ({ request, locals }) => {
	const person = locals.currentPerson;
	if (!person) error(401, 'ログインが必要です。');
	if (person.accountType !== 'internal' || !person.relayEnabled) {
		error(403, 'このアカウントには社内Relay権限がありません。');
	}

	const body = (await request.json()) as Record<string, unknown>;
	const relayId = body.relayId;
	const writable = body.writable;
	const lastErrorCode = body.lastErrorCode;
	if (typeof relayId !== 'string' || typeof writable !== 'boolean') {
		error(400, 'heartbeat内容が不正です。');
	}

	const relay = await getRelayRegistration(locals.db, relayId);
	if (!relay || relay.registeredBy !== person.id) error(404, 'Relayが見つかりません。');

	const now = new Date();
	await updateRelayRegistration(locals.db, relay.id, {
		storageConnectionId: relay.storageConnectionId,
		displayName: relay.displayName,
		allowedRootKey: relay.allowedRootKey,
		writable,
		lastHeartbeatAt: writable ? now : null,
		lastErrorCode: typeof lastErrorCode === 'string' ? lastErrorCode : null,
	});

	return json({
		status: deriveRelayStatus({ lastHeartbeatAt: writable ? now : null, writable, now }),
	});
};
