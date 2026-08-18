import { isCapabilityKey, type CapabilityKey } from '$lib/core/production-kernel';
import type { SqliteDb } from '../../db';
import { appendEvent } from '../repository/event-repository';
import {
	insertStudioTerm,
	retireStudioTermsForCapability,
} from '../repository/production-repository';

export async function defineStudioTerm(
	db: SqliteDb,
	input: {
		titleId: string;
		capabilityKey: CapabilityKey;
		displayName: string;
		aliases: string[];
		usageNote: string | null;
		definedBy: string;
	},
): Promise<{ ok: true } | { ok: false; error: 'invalid_term' }> {
	if (!isCapabilityKey(input.capabilityKey) || input.displayName.trim().length === 0) {
		return { ok: false, error: 'invalid_term' };
	}
	const now = new Date();
	return db.transaction(async (tx) => {
		const event = await appendEvent(
			tx,
			'title',
			input.titleId,
			{
				type: 'StudioTermDefined',
				payload: {
					capabilityKey: input.capabilityKey,
					displayName: input.displayName.trim(),
					aliases: input.aliases,
					usageNote: input.usageNote,
					definedBy: input.definedBy,
				},
			},
			now,
		);
		await retireStudioTermsForCapability(tx, input.titleId, input.capabilityKey, now);
		await insertStudioTerm(tx, {
			id: crypto.randomUUID(),
			titleId: input.titleId,
			capabilityKey: input.capabilityKey,
			displayName: input.displayName.trim(),
			aliases: input.aliases,
			usageNote: input.usageNote,
			activeFromEventId: event.id,
			retiredAt: null,
		});
		return { ok: true };
	});
}
