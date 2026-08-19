import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listAvailableRelayStorageConnections } from '$lib/server/shell/repository/relay-repository';

export const load: PageServerLoad = async ({ locals }) => {
	const person = locals.currentPerson;
	if (!person) error(401, 'Relayを開始するにはログインが必要です。');
	if (person.accountType !== 'internal' || !person.relayEnabled) {
		error(403, 'このアカウントには社内Relay権限がありません。');
	}

	return {
		currentPerson: person,
		storageConnections: await listAvailableRelayStorageConnections(locals.db),
	};
};
