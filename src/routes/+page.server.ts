import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as m from '$lib/paraglide/messages';
import { canWorkspaceRole } from '$lib/core/workspace-role';
import { BURNDOWN_STYLE_COOKIE, isBurndownStyle } from '$lib/theme';
import { createTitle } from '$lib/server/shell/commands/create-title';
import { getWorkspaceDashboard } from '$lib/server/shell/queries/get-workspace-dashboard';
import { listTitles } from '$lib/server/shell/queries/list-titles';
import { listInternalPersons } from '$lib/server/shell/repository/person-repository';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	const workspaceRole = locals.currentPerson?.workspaceRole;
	const canCreateTitle = canWorkspaceRole(workspaceRole, 'manageProduction');
	const titlesPromise = workspaceRole ? listTitles(locals.db) : Promise.resolve([]);
	const dashboardPromise =
		locals.currentPerson && workspaceRole
			? getWorkspaceDashboard(locals.db, locals.currentPerson.id, titlesPromise)
			: Promise.resolve({ workItems: [], frontierItems: [], activity: [], burndown: [] });
	const assignablePersonsPromise = canCreateTitle
		? listInternalPersons(locals.db)
		: Promise.resolve([]);
	const [titles, dashboard, assignablePersons] = await Promise.all([
		titlesPromise,
		dashboardPromise,
		assignablePersonsPromise,
	]);

	return {
		titles,
		assignablePersons,
		currentPerson: locals.currentPerson,
		canCreateTitle,
		burndownStyle: isBurndownStyle(cookies.get(BURNDOWN_STYLE_COOKIE))
			? cookies.get(BURNDOWN_STYLE_COOKIE)
			: 'standard',
		...dashboard,
	};
};

export const actions: Actions = {
	createTitle: async ({ request, locals }) => {
		if (!locals.currentPerson) {
			return fail(401, { message: m.error_login_required_hint() });
		}
		if (!canWorkspaceRole(locals.currentPerson.workspaceRole, 'manageProduction')) {
			return fail(403, { message: m.error_no_permission() });
		}
		const formData = await request.formData();
		const name = formData.get('name');
		const assigneeId = formData.get('assigneeId');
		if (typeof name !== 'string' || name.trim().length === 0) {
			return fail(400, { message: m.error_title_name_required() });
		}

		if (typeof assigneeId !== 'string' || assigneeId.length === 0) {
			return fail(400, { message: m.error_invalid_request() });
		}
		const result = await createTitle(locals.db, {
			name,
			createdBy: locals.currentPerson.id,
			assigneeId,
		});
		if (!result.ok) {
			return fail(400, { message: m.error_title_create_failed() });
		}

		redirect(303, `/${result.titleId}`);
	},
};
