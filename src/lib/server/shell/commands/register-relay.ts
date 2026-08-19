import type { SqliteDb } from '../../db';
import { appendEvent } from '../repository/event-repository';
import {
	getRelayRegistrationByBrowser,
	insertRelayRegistration,
	updateRelayRegistration,
} from '../repository/relay-repository';

export interface RegisterRelayInput {
	titleId: string;
	storageConnectionId: string;
	browserInstanceId: string;
	displayName: string;
	registeredBy: string;
	allowedRootKey: string;
	writable: boolean;
	lastErrorCode: string | null;
}

/** 同じtitle・browserInstanceではRelay IDを維持し、再許可後の再開を新端末扱いにしない。 */
export async function registerRelay(db: SqliteDb, input: RegisterRelayInput): Promise<string> {
	const now = new Date();
	return db.transaction(async (tx) => {
		const existing = await getRelayRegistrationByBrowser(
			tx,
			input.titleId,
			input.browserInstanceId,
		);
		const relayId = existing?.id ?? crypto.randomUUID();
		if (existing) {
			await updateRelayRegistration(tx, relayId, {
				storageConnectionId: input.storageConnectionId,
				displayName: input.displayName,
				allowedRootKey: input.allowedRootKey,
				writable: input.writable,
				lastHeartbeatAt: input.writable ? now : null,
				lastErrorCode: input.lastErrorCode,
			});
		} else {
			await insertRelayRegistration(tx, {
				id: relayId,
				titleId: input.titleId,
				storageConnectionId: input.storageConnectionId,
				browserInstanceId: input.browserInstanceId,
				displayName: input.displayName,
				registeredBy: input.registeredBy,
				allowedRootKey: input.allowedRootKey,
				writable: input.writable,
				lastHeartbeatAt: input.writable ? now : null,
				lastErrorCode: input.lastErrorCode,
				createdAt: now,
			});
		}
		await appendEvent(
			tx,
			'relay',
			relayId,
			{
				type: existing ? 'RelayReconnected' : 'RelayRegistered',
				payload: {
					titleId: input.titleId,
					storageConnectionId: input.storageConnectionId,
					displayName: input.displayName,
					writable: input.writable,
				},
			},
			now,
		);
		return relayId;
	});
}
