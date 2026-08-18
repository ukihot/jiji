import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import * as m from '$lib/paraglide/messages';
import { canWorkspaceRole } from '$lib/core/workspace-role';
import { listRecentEvents } from '$lib/server/shell/repository/event-repository';

export const load: PageServerLoad = async ({ locals }) => {
	if (!canWorkspaceRole(locals.currentPerson?.workspaceRole, 'auditLogs')) {
		error(403, m.error_no_permission());
	}
	return { events: await listRecentEvents(locals.db), currentPerson: locals.currentPerson };
};
