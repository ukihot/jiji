import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as m from '$lib/paraglide/messages';
import { createTimeline } from '$lib/server/shell/commands/create-timeline';
import { listTimelinesForTitle } from '$lib/server/shell/queries/list-timelines';
import { hasAtLeast } from '$lib/server/shell/authorization';

export const load: PageServerLoad = async ({ params, locals }) => {
	const result = await listTimelinesForTitle(locals.db, params.titleId);
	if (!result) error(404, m.error_title_not_found());

	const canManage = locals.currentPerson
		? await hasAtLeast(locals.db, locals.currentPerson.id, params.titleId, 'admin')
		: false;

	return { ...result, currentPerson: locals.currentPerson, canManage };
};

export const actions: Actions = {
	createTimeline: async ({ request, params, locals }) => {
		if (!locals.currentPerson) return fail(401, { message: m.error_login_required() });
		if (!(await hasAtLeast(locals.db, locals.currentPerson.id, params.titleId, 'admin'))) {
			return fail(403, { message: m.error_admin_required_add_timeline() });
		}

		const formData = await request.formData();
		const season = formData.get('season');
		const episode = Number(formData.get('episode'));
		if (typeof season !== 'string' || season.trim().length === 0) {
			return fail(400, { message: m.error_season_required() });
		}
		if (!Number.isInteger(episode) || episode < 1) {
			return fail(400, { message: m.error_episode_invalid() });
		}

		const result = await createTimeline(locals.db, { titleId: params.titleId, season, episode });
		if (!result.ok) return fail(400, { message: m.error_timeline_create_failed() });

		redirect(303, `/${params.titleId}/${result.timelineId}`);
	},
};
