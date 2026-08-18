import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as m from '$lib/paraglide/messages';
import { setCurrentPersonId } from '$lib/server/auth/internal';
import { listInternalPersons } from '$lib/server/shell/repository/person-repository';
import { getPerson } from '$lib/server/shell/repository/person-repository';
import { appendEvent } from '$lib/server/shell/repository/event-repository';

function auditRequest(request: Request) {
	return {
		ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
		userAgent: request.headers.get('user-agent') ?? null,
	};
}

/** design.md 8.4節: ID/PW+TOTPの本実装の代わりの開発用スタブ */
export const load: PageServerLoad = async ({ locals }) => {
	return { persons: await listInternalPersons(locals.db), currentPerson: locals.currentPerson };
};

export const actions: Actions = {
	default: async ({ request, cookies, locals }) => {
		const formData = await request.formData();
		const personId = formData.get('personId');
		if (typeof personId !== 'string' || personId.length === 0) {
			await appendEvent(
				locals.db,
				'auth',
				'workspace',
				{
					type: 'LoginFailed',
					payload: { reason: 'person_not_selected', ...auditRequest(request) },
				},
				new Date(),
			);
			return fail(400, { message: m.error_select_required() });
		}
		const person = await getPerson(locals.db, personId);
		if (!person || person.accountType !== 'internal' || !person.workspaceRole) {
			await appendEvent(
				locals.db,
				'auth',
				'workspace',
				{
					type: 'LoginFailed',
					payload: { personId, reason: 'account_not_allowed', ...auditRequest(request) },
				},
				new Date(),
			);
			return fail(403, { message: m.error_no_permission() });
		}
		await appendEvent(
			locals.db,
			'auth',
			'workspace',
			{
				type: 'LoginSucceeded',
				payload: {
					personId: person.id,
					name: person.name,
					role: person.workspaceRole,
					...auditRequest(request),
				},
			},
			new Date(),
		);
		setCurrentPersonId(cookies, personId);
		redirect(303, '/');
	},
};
