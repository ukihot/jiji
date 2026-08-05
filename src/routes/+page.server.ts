import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createTitle } from '$lib/server/shell/commands/create-title';
import { listTitles } from '$lib/server/shell/queries/list-titles';

export const load: PageServerLoad = async ({ locals }) => {
	return { titles: await listTitles(locals.db), currentPerson: locals.currentPerson };
};

export const actions: Actions = {
	createTitle: async ({ request, locals }) => {
		if (!locals.currentPerson) {
			return fail(401, { message: 'ログインしてください（開発用ログインから）' });
		}
		const formData = await request.formData();
		const name = formData.get('name');
		if (typeof name !== 'string' || name.trim().length === 0) {
			return fail(400, { message: '作品名を入力してください' });
		}

		const result = await createTitle(locals.db, { name, createdBy: locals.currentPerson.id });
		if (!result.ok) {
			return fail(400, { message: '作品を作成できませんでした' });
		}

		redirect(303, `/${result.titleId}`);
	},
};
