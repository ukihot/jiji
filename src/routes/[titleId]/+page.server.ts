import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createTimeline } from '$lib/server/shell/commands/create-timeline';
import { listTimelinesForTitle } from '$lib/server/shell/queries/list-timelines';
import { hasAtLeast } from '$lib/server/shell/authorization';

export const load: PageServerLoad = async ({ params, locals }) => {
	const result = await listTimelinesForTitle(locals.db, params.titleId);
	if (!result) error(404, '作品が見つかりません');

	const canManage = locals.currentPerson
		? await hasAtLeast(locals.db, locals.currentPerson.id, params.titleId, 'admin')
		: false;

	return { ...result, currentPerson: locals.currentPerson, canManage };
};

export const actions: Actions = {
	createTimeline: async ({ request, params, locals }) => {
		if (!locals.currentPerson) return fail(401, { message: 'ログインしてください' });
		if (!(await hasAtLeast(locals.db, locals.currentPerson.id, params.titleId, 'admin'))) {
			return fail(403, { message: 'この作品の管理者だけが話数を追加できます' });
		}

		const formData = await request.formData();
		const season = formData.get('season');
		const episode = Number(formData.get('episode'));
		if (typeof season !== 'string' || season.trim().length === 0) {
			return fail(400, { message: '期を入力してください' });
		}
		if (!Number.isInteger(episode) || episode < 1) {
			return fail(400, { message: '話数は1以上の整数で入力してください' });
		}

		const result = await createTimeline(locals.db, { titleId: params.titleId, season, episode });
		if (!result.ok)
			return fail(400, { message: '話数を作成できませんでした（既に存在するかもしれません）' });

		redirect(303, `/${params.titleId}/${result.timelineId}`);
	},
};
