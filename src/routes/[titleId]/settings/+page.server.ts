import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	REPRESENTATION_TYPES,
	applyRepresentationTypesDefault,
	isRepresentationType,
} from '$lib/core/representation';
import * as m from '$lib/paraglide/messages';
import { canWorkspaceRole } from '$lib/core/workspace-role';
import { publishProductionBlueprint } from '$lib/server/shell/commands/publish-production-blueprint';
import { defineStudioTerm } from '$lib/server/shell/commands/define-studio-term';
import { isCapabilityKey, projectStructureMap } from '$lib/core/production-kernel';
import {
	getPublishedBlueprint,
	listActiveStudioTerms,
	listEnabledRepresentationTypes,
	listProcessEdges,
	listProcessNodes,
} from '$lib/server/shell/repository/production-repository';
import { getTitle } from '$lib/server/shell/repository/timeline-repository';

/**
 * design.md 12章/8.6節: 「メニューや管理画面は作品の裏側に置く」。メンバー管理・Representation設定など
 * プロジェクト単位の設定をこのページ配下にまとめる（作品トップに個別リンクを浮かせない）。
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	if (!canWorkspaceRole(locals.currentPerson?.workspaceRole, 'viewWorkspace')) {
		error(403, m.error_no_permission());
	}
	const title = await getTitle(locals.db, params.titleId);
	if (!title) error(404, m.error_title_not_found());
	if (!canWorkspaceRole(locals.currentPerson?.workspaceRole, 'manageProduction')) {
		error(403, m.error_settings_page_admin_required());
	}

	const [configured, blueprint, terms] = await Promise.all([
		listEnabledRepresentationTypes(locals.db, params.titleId),
		getPublishedBlueprint(locals.db, params.titleId),
		listActiveStudioTerms(locals.db, params.titleId),
	]);
	const enabledTypes = applyRepresentationTypesDefault(configured);
	const nodes = blueprint ? await listProcessNodes(locals.db, blueprint.id) : [];
	const structureMap = blueprint
		? projectStructureMap({ nodes, edges: await listProcessEdges(locals.db, blueprint.id) })
		: null;

	return {
		title,
		currentPerson: locals.currentPerson,
		representationTypes: REPRESENTATION_TYPES.map((type) => ({
			type,
			enabled: enabledTypes.has(type),
		})),
		blueprint: blueprint ? { ...blueprint, nodes } : null,
		structureMap,
		terms,
	};
};

export const actions: Actions = {
	updateRepresentationTypes: async ({ request, params, locals }) => {
		if (!locals.currentPerson) return fail(401, { message: m.error_login_required() });
		if (!canWorkspaceRole(locals.currentPerson.workspaceRole, 'manageProduction')) {
			return fail(403, { message: m.error_no_permission() });
		}

		const formData = await request.formData();
		const enabledTypes = formData.getAll('enabledTypes').filter(isRepresentationType);

		const result = await publishProductionBlueprint(locals.db, {
			titleId: params.titleId,
			enabledTypes,
			publishedBy: locals.currentPerson.id,
		});
		if (!result.ok) return fail(400, { message: m.error_no_types_selected() });

		return { success: true, version: result.version };
	},

	defineStudioTerm: async ({ request, params, locals }) => {
		if (!locals.currentPerson) return fail(401, { message: m.error_login_required() });
		if (!canWorkspaceRole(locals.currentPerson.workspaceRole, 'manageProduction')) {
			return fail(403, { message: m.error_no_permission() });
		}
		const formData = await request.formData();
		const capabilityKey = formData.get('capabilityKey');
		const displayName = formData.get('displayName');
		const aliasesRaw = formData.get('aliases');
		const usageNoteRaw = formData.get('usageNote');
		if (!isCapabilityKey(capabilityKey) || typeof displayName !== 'string') {
			return fail(400, { message: m.error_invalid_request() });
		}
		const result = await defineStudioTerm(locals.db, {
			titleId: params.titleId,
			capabilityKey,
			displayName,
			aliases:
				typeof aliasesRaw === 'string'
					? aliasesRaw
							.split(',')
							.map((alias) => alias.trim())
							.filter(Boolean)
					: [],
			usageNote:
				typeof usageNoteRaw === 'string' && usageNoteRaw.trim().length > 0
					? usageNoteRaw.trim()
					: null,
			definedBy: locals.currentPerson.id,
		});
		if (!result.ok) return fail(400, { message: m.error_invalid_request() });
		return { success: true };
	},
};
