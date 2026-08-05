import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as m from '$lib/paraglide/messages';
import { createTitle } from '$lib/server/shell/commands/create-title';
import { listTitles } from '$lib/server/shell/queries/list-titles';

export const load: PageServerLoad = async ({ locals }) => {
	return { titles: await listTitles(locals.db), currentPerson: locals.currentPerson };
};

export const actions: Actions = {
	createTitle: async ({ request, locals }) => {
		if (!locals.currentPerson) {
			return fail(401, { message: m.error_login_required_hint() });
		}
		const formData = await request.formData();
		const name = formData.get('name');
		if (typeof name !== 'string' || name.trim().length === 0) {
			return fail(400, { message: m.error_title_name_required() });
		}

		const result = await createTitle(locals.db, { name, createdBy: locals.currentPerson.id });
		if (!result.ok) {
			return fail(400, { message: m.error_title_create_failed() });
		}

		redirect(303, `/${result.titleId}`);
	},
};
