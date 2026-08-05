import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as m from '$lib/paraglide/messages';
import { setCurrentPersonId } from '$lib/server/auth/internal';
import { listInternalPersons } from '$lib/server/shell/repository/person-repository';

/** design.md 8.4節: ID/PW+TOTPの本実装の代わりの開発用スタブ */
export const load: PageServerLoad = async ({ locals }) => {
	return { persons: await listInternalPersons(locals.db), currentPerson: locals.currentPerson };
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const personId = formData.get('personId');
		if (typeof personId !== 'string' || personId.length === 0) {
			return fail(400, { message: m.error_select_required() });
		}
		setCurrentPersonId(cookies, personId);
		redirect(303, '/');
	},
};
