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
import { configureRelayStorage } from '$lib/server/shell/commands/configure-relay-storage';
import { setRelayStorageCredentials } from '$lib/server/shell/commands/set-relay-storage-credentials';
import { isRelayStorageProvider } from '$lib/core/relay';
import {
	countPendingRelayJobs,
	listRelayRegistrations,
	listRelayStorageConnections,
} from '$lib/server/shell/repository/relay-repository';
import { deriveRelayStatus } from '$lib/core/relay';

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

	const [
		configured,
		blueprint,
		terms,
		relayStorageConnections,
		relayRegistrations,
		pendingRelayJobs,
	] = await Promise.all([
		listEnabledRepresentationTypes(locals.db, params.titleId),
		getPublishedBlueprint(locals.db, params.titleId),
		listActiveStudioTerms(locals.db, params.titleId),
		listRelayStorageConnections(locals.db, params.titleId),
		listRelayRegistrations(locals.db, params.titleId),
		countPendingRelayJobs(locals.db, params.titleId),
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
		relayStorageConnections,
		relayRegistrations: relayRegistrations.map((relay) => ({
			...relay,
			status: deriveRelayStatus({
				lastHeartbeatAt: relay.lastHeartbeatAt,
				writable: relay.writable,
				now: new Date(),
			}),
		})),
		pendingRelayJobs,
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

	configureRelayStorage: async ({ request, params, locals }) => {
		if (!locals.currentPerson) return fail(401, { message: m.error_login_required() });
		if (!canWorkspaceRole(locals.currentPerson.workspaceRole, 'manageProduction')) {
			return fail(403, { message: m.error_no_permission() });
		}
		const formData = await request.formData();
		const provider = formData.get('provider');
		const bucketOrContainer = formData.get('bucketOrContainer');
		const endpoint = formData.get('endpoint');
		const region = formData.get('region');
		const prefix = formData.get('prefix');
		const authRef = formData.get('authRef');
		if (
			!isRelayStorageProvider(provider) ||
			typeof bucketOrContainer !== 'string' ||
			typeof endpoint !== 'string' ||
			typeof region !== 'string' ||
			typeof prefix !== 'string' ||
			typeof authRef !== 'string'
		) {
			return fail(400, { message: m.error_invalid_request() });
		}
		const accessKeyIdRaw = formData.get('accessKeyId');
		const secretAccessKeyRaw = formData.get('secretAccessKey');
		const result = await configureRelayStorage(locals.db, {
			titleId: params.titleId,
			provider,
			bucketOrContainer,
			endpoint,
			region,
			prefix,
			authRef,
			accessKeyId: typeof accessKeyIdRaw === 'string' ? accessKeyIdRaw : null,
			secretAccessKey: typeof secretAccessKeyRaw === 'string' ? secretAccessKeyRaw : null,
			configuredBy: locals.currentPerson.id,
		});
		if (!result.ok) return fail(400, { message: `Relayストレージ設定エラー: ${result.error}` });
		return { relayStorageConnection: result.connection.id };
	},

	setRelayStorageCredentials: async ({ request, params, locals }) => {
		if (!locals.currentPerson) return fail(401, { message: m.error_login_required() });
		if (!canWorkspaceRole(locals.currentPerson.workspaceRole, 'manageProduction')) {
			return fail(403, { message: m.error_no_permission() });
		}
		const formData = await request.formData();
		const connectionId = formData.get('connectionId');
		const accessKeyId = formData.get('accessKeyId');
		const secretAccessKey = formData.get('secretAccessKey');
		if (
			typeof connectionId !== 'string' ||
			typeof accessKeyId !== 'string' ||
			typeof secretAccessKey !== 'string'
		) {
			return fail(400, { message: m.error_invalid_request() });
		}
		const result = await setRelayStorageCredentials(locals.db, {
			connectionId,
			titleId: params.titleId,
			accessKeyId,
			secretAccessKey,
			updatedBy: locals.currentPerson.id,
		});
		if (!result.ok) return fail(400, { message: `資格情報の設定エラー: ${result.error}` });
		return { relayStorageCredentialsUpdated: connectionId };
	},
};
