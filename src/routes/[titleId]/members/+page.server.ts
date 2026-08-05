import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { PermissionLevel } from '$lib/core/membership';
import * as m from '$lib/paraglide/messages';
import { createPerson } from '$lib/server/shell/commands/create-person';
import { grantMembership } from '$lib/server/shell/commands/grant-membership';
import { revokeMembership } from '$lib/server/shell/commands/revoke-membership';
import { updateMembership } from '$lib/server/shell/commands/update-membership';
import { hasAtLeast } from '$lib/server/shell/authorization';
import { getMembership } from '$lib/server/shell/repository/membership-repository';
import { listPersons } from '$lib/server/shell/repository/person-repository';
import { getTitle, listTimelinesByTitle } from '$lib/server/shell/repository/timeline-repository';
import { listMembers } from '$lib/server/shell/queries/list-members';

const PERMISSION_LEVELS = ['viewer', 'contributor', 'reviewer', 'admin'] as const;

function isPermissionLevel(value: unknown): value is PermissionLevel {
	return typeof value === 'string' && (PERMISSION_LEVELS as readonly string[]).includes(value);
}

/** design.md 8.6節: 作品全体スコープ ＋ その作品配下の各話数スコープのmembershipをまとめて見せる */
export const load: PageServerLoad = async ({ params, locals }) => {
	const title = await getTitle(locals.db, params.titleId);
	if (!title) error(404, m.error_title_not_found());
	if (
		!locals.currentPerson ||
		!(await hasAtLeast(locals.db, locals.currentPerson.id, params.titleId, 'admin'))
	) {
		error(403, m.error_members_page_admin_required());
	}

	const timelines = await listTimelinesByTitle(locals.db, params.titleId);
	const members = [
		...(await listMembers(locals.db, 'title', params.titleId)),
		...(
			await Promise.all(
				timelines.map((timeline) => listMembers(locals.db, 'timeline', timeline.id)),
			)
		).flat(),
	];

	return {
		title,
		timelines,
		members,
		persons: await listPersons(locals.db),
		currentPerson: locals.currentPerson,
	};
};

export const actions: Actions = {
	invite: async ({ request, params, locals }) => {
		if (!locals.currentPerson) return fail(401, { message: m.error_login_required() });
		if (!(await hasAtLeast(locals.db, locals.currentPerson.id, params.titleId, 'admin'))) {
			return fail(403, { message: m.error_admin_required_invite() });
		}

		const formData = await request.formData();
		const existingPersonId = formData.get('existingPersonId');
		const newName = formData.get('newName');
		const newEmail = formData.get('newEmail');
		const newAccountType = formData.get('newAccountType');
		const scopeType = formData.get('scopeType');
		const scopeTimelineId = formData.get('scopeTimelineId');
		const permissionLevel = formData.get('permissionLevel');
		const processScopeRaw = formData.get('processScope');
		const expiresAtRaw = formData.get('expiresAt');

		let personId: string;
		if (typeof existingPersonId === 'string' && existingPersonId.length > 0) {
			personId = existingPersonId;
		} else {
			if (typeof newName !== 'string' || newName.trim().length === 0) {
				return fail(400, { message: m.error_invite_name_required() });
			}
			if (newAccountType !== 'internal' && newAccountType !== 'external') {
				return fail(400, { message: m.error_account_type_required() });
			}
			const createResult = await createPerson(locals.db, {
				name: newName,
				email: typeof newEmail === 'string' && newEmail.trim().length > 0 ? newEmail : null,
				accountType: newAccountType,
			});
			if (!createResult.ok) return fail(400, { message: m.error_person_create_failed() });
			personId = createResult.personId;
		}

		if (!isPermissionLevel(permissionLevel)) {
			return fail(400, { message: m.error_permission_required() });
		}

		const resolvedScopeType: 'title' | 'timeline' = scopeType === 'timeline' ? 'timeline' : 'title';
		const scopeId =
			resolvedScopeType === 'timeline' &&
			typeof scopeTimelineId === 'string' &&
			scopeTimelineId.length > 0
				? scopeTimelineId
				: params.titleId;

		const processScope =
			typeof processScopeRaw === 'string' && processScopeRaw.trim().length > 0
				? processScopeRaw
						.split(',')
						.map((tag) => tag.trim())
						.filter((tag) => tag.length > 0)
				: null;

		const expiresAt =
			typeof expiresAtRaw === 'string' && expiresAtRaw.length > 0 ? new Date(expiresAtRaw) : null;

		const result = await grantMembership(locals.db, {
			personId,
			scopeType: resolvedScopeType,
			scopeId,
			permissionLevel,
			processScope,
			grantedBy: locals.currentPerson.id,
			expiresAt,
		});

		if (!result.ok) {
			const message =
				result.error.kind === 'expiry_required'
					? m.error_expiry_required_for_scope()
					: result.error.kind === 'person_not_found'
						? m.error_person_not_found()
						: m.error_invite_failed();
			return fail(400, { message });
		}

		return { success: true };
	},

	updatePermission: async ({ request, params, locals }) => {
		if (!locals.currentPerson) return fail(401, { message: m.error_login_required() });
		if (!(await hasAtLeast(locals.db, locals.currentPerson.id, params.titleId, 'admin'))) {
			return fail(403, { message: m.error_no_permission() });
		}

		const formData = await request.formData();
		const membershipId = formData.get('membershipId');
		const permissionLevel = formData.get('permissionLevel');
		if (typeof membershipId !== 'string') return fail(400, { message: m.error_invalid_request() });
		if (!isPermissionLevel(permissionLevel))
			return fail(400, { message: m.error_permission_required() });

		const current = await getMembership(locals.db, membershipId);
		if (!current) return fail(404, { message: m.error_not_found() });

		const result = await updateMembership(locals.db, {
			membershipId,
			permissionLevel,
			processScope: current.processScope,
		});
		if (!result.ok) {
			const message =
				result.error.kind === 'last_admin_lockout'
					? m.error_last_admin_demote()
					: m.error_update_failed();
			return fail(400, { message });
		}
		return { success: true };
	},

	revoke: async ({ request, params, locals }) => {
		if (!locals.currentPerson) return fail(401, { message: m.error_login_required() });
		if (!(await hasAtLeast(locals.db, locals.currentPerson.id, params.titleId, 'admin'))) {
			return fail(403, { message: m.error_no_permission() });
		}

		const formData = await request.formData();
		const membershipId = formData.get('membershipId');
		if (typeof membershipId !== 'string') return fail(400, { message: m.error_invalid_request() });

		const result = await revokeMembership(locals.db, {
			membershipId,
			revokedBy: locals.currentPerson.id,
		});
		if (!result.ok) {
			const message =
				result.error.kind === 'last_admin_lockout'
					? m.error_last_admin_revoke()
					: m.error_revoke_failed();
			return fail(400, { message });
		}
		return { success: true };
	},
};
