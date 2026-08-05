import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { SharePermissionLevel } from '$lib/core/share-link';
import * as m from '$lib/paraglide/messages';
import { addCut } from '$lib/server/shell/commands/add-cut';
import { createShareLink } from '$lib/server/shell/commands/create-share-link';
import { revokeShareLink } from '$lib/server/shell/commands/revoke-share-link';
import { hasAtLeast } from '$lib/server/shell/authorization';
import { getTimelineView } from '$lib/server/shell/queries/get-timeline-view';
import { listShareLinksForCuts } from '$lib/server/shell/queries/list-share-links';

export const load: PageServerLoad = async ({ params, locals }) => {
	const view = await getTimelineView(locals.db, params.titleId, params.timelineId);
	if (!view) error(404, m.error_timeline_not_found());

	const now = new Date();
	const canAddCut = locals.currentPerson
		? await hasAtLeast(
				locals.db,
				locals.currentPerson.id,
				params.titleId,
				'contributor',
				now,
				params.timelineId,
			)
		: false;
	const canShare = locals.currentPerson
		? await hasAtLeast(
				locals.db,
				locals.currentPerson.id,
				params.titleId,
				'admin',
				now,
				params.timelineId,
			)
		: false;

	const shareLinks = canShare
		? await listShareLinksForCuts(
				locals.db,
				view.cuts.map((cut) => cut.cutId),
				now,
			)
		: [];

	return { view, currentPerson: locals.currentPerson, canAddCut, canShare, shareLinks };
};

export const actions: Actions = {
	addCut: async ({ request, params, locals }) => {
		if (!locals.currentPerson) return fail(401, { message: m.error_login_required() });
		if (
			!(await hasAtLeast(
				locals.db,
				locals.currentPerson.id,
				params.titleId,
				'contributor',
				new Date(),
				params.timelineId,
			))
		) {
			return fail(403, { message: m.error_no_permission_add_cut() });
		}

		const formData = await request.formData();
		const number = formData.get('number');
		const sortOrder = Number(formData.get('sortOrder'));
		const plannedFrames = Number(formData.get('plannedFrames'));
		const sceneTagsRaw = formData.get('sceneTags');
		const sceneTags =
			typeof sceneTagsRaw === 'string' && sceneTagsRaw.trim().length > 0
				? sceneTagsRaw
						.split(',')
						.map((tag) => tag.trim())
						.filter((tag) => tag.length > 0)
				: [];

		if (typeof number !== 'string' || number.trim().length === 0) {
			return fail(400, { message: m.error_cut_number_required() });
		}
		if (!Number.isInteger(sortOrder)) {
			return fail(400, { message: m.error_sort_order_invalid() });
		}
		if (!Number.isFinite(plannedFrames) || plannedFrames <= 0) {
			return fail(400, { message: m.error_planned_frames_invalid() });
		}

		const result = await addCut(locals.db, {
			timelineId: params.timelineId,
			number,
			sortOrder,
			plannedFrames,
			sceneTags,
		});
		if (!result.ok) {
			return fail(400, { message: m.error_add_cut_failed() });
		}

		return { success: true };
	},

	createShareLink: async ({ request, params, locals }) => {
		if (!locals.currentPerson) return fail(401, { message: m.error_login_required() });
		if (
			!(await hasAtLeast(
				locals.db,
				locals.currentPerson.id,
				params.titleId,
				'admin',
				new Date(),
				params.timelineId,
			))
		) {
			return fail(403, { message: m.error_admin_required_sharelink() });
		}

		const formData = await request.formData();
		const cutIds = formData
			.getAll('cutIds')
			.filter((value): value is string => typeof value === 'string');
		const permissionLevelRaw = formData.get('permissionLevel');
		const expiresInDays = Number(formData.get('expiresInDays'));

		if (cutIds.length === 0) return fail(400, { message: m.error_no_cuts_selected() });
		if (permissionLevelRaw !== 'viewer' && permissionLevelRaw !== 'contributor') {
			return fail(400, { message: m.error_permission_required() });
		}
		const permissionLevel: SharePermissionLevel = permissionLevelRaw;
		if (!Number.isFinite(expiresInDays) || expiresInDays <= 0 || expiresInDays > 90) {
			return fail(400, { message: m.error_expiry_days_invalid() });
		}

		const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
		const result = await createShareLink(locals.db, {
			targetCutIds: cutIds,
			permissionLevel,
			createdBy: locals.currentPerson.id,
			expiresAt,
		});
		if (!result.ok) return fail(400, { message: m.error_sharelink_create_failed() });

		const shareUrl = `${new URL(request.url).origin}/s/${result.token}`;
		return { success: true, shareLinkCreated: { url: shareUrl, expiresAt } };
	},

	revokeShareLink: async ({ request, params, locals }) => {
		if (!locals.currentPerson) return fail(401, { message: m.error_login_required() });
		if (
			!(await hasAtLeast(
				locals.db,
				locals.currentPerson.id,
				params.titleId,
				'admin',
				new Date(),
				params.timelineId,
			))
		) {
			return fail(403, { message: m.error_no_permission() });
		}

		const formData = await request.formData();
		const shareLinkId = formData.get('shareLinkId');
		if (typeof shareLinkId !== 'string') return fail(400, { message: m.error_invalid_request() });

		const result = await revokeShareLink(locals.db, {
			shareLinkId,
			revokedBy: locals.currentPerson.id,
		});
		if (!result.ok) return fail(400, { message: m.error_revoke_failed() });

		return { success: true };
	},
};
