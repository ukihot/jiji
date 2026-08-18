import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as m from '$lib/paraglide/messages';
import { canWorkspaceRole } from '$lib/core/workspace-role';
import { createTimeline } from '$lib/server/shell/commands/create-timeline';
import { listTimelinesForTitle } from '$lib/server/shell/queries/list-timelines';
import { listInternalPersons } from '$lib/server/shell/repository/person-repository';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!canWorkspaceRole(locals.currentPerson?.workspaceRole, 'viewWorkspace')) {
		error(403, m.error_no_permission());
	}
	const result = await listTimelinesForTitle(locals.db, params.titleId);
	if (!result) error(404, m.error_title_not_found());

	const canManage = canWorkspaceRole(locals.currentPerson?.workspaceRole, 'manageProduction');

	return {
		...result,
		currentPerson: locals.currentPerson,
		canManage,
		assignablePersons: canManage ? await listInternalPersons(locals.db) : [],
	};
};

export const actions: Actions = {
	createTimeline: async ({ request, params, locals }) => {
		if (!locals.currentPerson) return fail(401, { message: m.error_login_required() });
		if (!canWorkspaceRole(locals.currentPerson.workspaceRole, 'manageProduction')) {
			return fail(403, { message: m.error_admin_required_add_timeline() });
		}

		const formData = await request.formData();
		const season = formData.get('season');
		const episode = Number(formData.get('episode'));
		const assigneeId = formData.get('assigneeId');
		if (typeof season !== 'string' || season.trim().length === 0) {
			return fail(400, { message: m.error_season_required() });
		}
		if (!Number.isInteger(episode) || episode < 1) {
			return fail(400, { message: m.error_episode_invalid() });
		}
		if (typeof assigneeId !== 'string' || assigneeId.length === 0) {
			return fail(400, { message: m.error_invalid_request() });
		}

		const result = await createTimeline(locals.db, {
			titleId: params.titleId,
			season,
			episode,
			assigneeId,
		});
		if (!result.ok) return fail(400, { message: m.error_timeline_create_failed() });

		redirect(303, `/${params.titleId}/${result.timelineId}`);
	},
};
