import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	REPRESENTATION_TYPES,
	applyRepresentationTypesDefault,
	isRepresentationType,
} from '$lib/core/representation';
import * as m from '$lib/paraglide/messages';
import { configureRepresentationTypes } from '$lib/server/shell/commands/configure-representation-types';
import { hasAtLeast } from '$lib/server/shell/authorization';
import { listEnabledRepresentationTypes } from '$lib/server/shell/repository/production-repository';
import { getTitle } from '$lib/server/shell/repository/timeline-repository';

/**
 * design.md 12章/8.6節: 「メニューや管理画面は作品の裏側に置く」。メンバー管理・Representation設定など
 * プロジェクト単位の設定をこのページ配下にまとめる（作品トップに個別リンクを浮かせない）。
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	const title = await getTitle(locals.db, params.titleId);
	if (!title) error(404, m.error_title_not_found());
	if (
		!locals.currentPerson ||
		!(await hasAtLeast(locals.db, locals.currentPerson.id, params.titleId, 'admin'))
	) {
		error(403, m.error_settings_page_admin_required());
	}

	const configured = await listEnabledRepresentationTypes(locals.db, params.titleId);
	const enabledTypes = applyRepresentationTypesDefault(configured);

	return {
		title,
		currentPerson: locals.currentPerson,
		representationTypes: REPRESENTATION_TYPES.map((type) => ({
			type,
			enabled: enabledTypes.has(type),
		})),
	};
};

export const actions: Actions = {
	updateRepresentationTypes: async ({ request, params, locals }) => {
		if (!locals.currentPerson) return fail(401, { message: m.error_login_required() });
		if (!(await hasAtLeast(locals.db, locals.currentPerson.id, params.titleId, 'admin'))) {
			return fail(403, { message: m.error_no_permission() });
		}

		const formData = await request.formData();
		const enabledTypes = formData.getAll('enabledTypes').filter(isRepresentationType);

		const result = await configureRepresentationTypes(locals.db, {
			titleId: params.titleId,
			enabledTypes,
			configuredBy: locals.currentPerson.id,
		});
		if (!result.ok) return fail(400, { message: m.error_no_types_selected() });

		return { success: true };
	},
};
