import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	isDerivedFromRelation,
	isRepresentationType,
	isReviewResult,
} from '$lib/core/representation';
import * as m from '$lib/paraglide/messages';
import { submitVersion } from '$lib/server/shell/commands/submit-version';
import { submitReview } from '$lib/server/shell/commands/submit-review';
import { sealVersion } from '$lib/server/shell/commands/seal-version';
import { recordGateEvidence } from '$lib/server/shell/commands/record-gate-evidence';
import { hasShareLinkAccess, hasShareLinkContributorAccess } from '$lib/server/shell/authorization';
import { canWorkspaceRole } from '$lib/core/workspace-role';
import { getCutEvolutionView } from '$lib/server/shell/queries/get-cut-evolution-view';
import { assignRepresentation } from '$lib/server/shell/commands/assign-representation';
import { listInternalPersons } from '$lib/server/shell/repository/person-repository';

/**
 * design.md 8.5節/F-13: membership（社内・単話参加）に加え、Magic Identityの共有リンクだけを
 * 持つ外部作業者もこのcutへの提出ができるようにする（authorization.tsのhasShareLinkContributorAccess参照）。
 */
async function canSubmitVersion(locals: App.Locals, cutId: string, now: Date): Promise<boolean> {
	if (!locals.currentPerson) return false;
	if (canWorkspaceRole(locals.currentPerson.workspaceRole, 'submitProductionUpdate')) {
		return true;
	}
	return hasShareLinkContributorAccess(locals.db, locals.currentPerson.id, cutId, now);
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const view = await getCutEvolutionView(
		locals.db,
		params.titleId,
		params.timelineId,
		params.cutId,
	);
	if (!view) error(404, m.error_cut_not_found());

	const now = new Date();
	const canView =
		canWorkspaceRole(locals.currentPerson?.workspaceRole, 'viewWorkspace') ||
		(locals.currentPerson
			? await hasShareLinkAccess(locals.db, locals.currentPerson.id, params.cutId, now)
			: false);
	if (!canView) error(403, m.error_no_permission());
	const canSubmit = await canSubmitVersion(locals, params.cutId, now);
	const canReview = canWorkspaceRole(locals.currentPerson?.workspaceRole, 'manageProduction');
	// design.md 8.2節: Seal操作はadminのみ（reviewerでも不可）
	const canSeal = canWorkspaceRole(locals.currentPerson?.workspaceRole, 'manageProduction');

	return {
		view,
		currentPerson: locals.currentPerson,
		canSubmit,
		canReview,
		canSeal,
		canManageAssignments: canWorkspaceRole(locals.currentPerson?.workspaceRole, 'manageProduction'),
		assignablePersons: canWorkspaceRole(locals.currentPerson?.workspaceRole, 'manageProduction')
			? await listInternalPersons(locals.db)
			: [],
	};
};

export const actions: Actions = {
	assignRepresentation: async ({ request, params, locals }) => {
		if (!locals.currentPerson) return fail(401, { message: m.error_login_required() });
		if (!canWorkspaceRole(locals.currentPerson.workspaceRole, 'manageProduction')) {
			return fail(403, { message: m.error_no_permission() });
		}
		const formData = await request.formData();
		const type = formData.get('representationType');
		const assigneeId = formData.get('assigneeId');
		if (!isRepresentationType(type) || typeof assigneeId !== 'string' || assigneeId.length === 0) {
			return fail(400, { message: m.error_invalid_request() });
		}
		await assignRepresentation(locals.db, {
			cutId: params.cutId,
			type,
			assigneeId,
			assignedBy: locals.currentPerson.id,
		});
		return { success: true };
	},

	submitVersion: async ({ request, params, locals }) => {
		if (!locals.currentPerson) return fail(401, { message: m.error_login_required() });
		if (!(await canSubmitVersion(locals, params.cutId, new Date()))) {
			return fail(403, { message: m.error_no_permission_submit_version() });
		}

		const formData = await request.formData();
		const representationType = formData.get('representationType');
		const processStep = formData.get('processStep');
		const fileRef = formData.get('fileRef');
		const proxyRefRaw = formData.get('proxyRef');
		const derivedFromVersionIdRaw = formData.get('derivedFromVersionId');
		const derivedFromRelationRaw = formData.get('derivedFromRelation');

		if (!isRepresentationType(representationType)) {
			return fail(400, { message: m.error_representation_type_required() });
		}
		if (typeof processStep !== 'string' || processStep.trim().length === 0) {
			return fail(400, { message: m.error_process_step_required() });
		}
		if (typeof fileRef !== 'string' || fileRef.trim().length === 0) {
			return fail(400, { message: m.error_file_ref_required() });
		}
		const proxyRef =
			typeof proxyRefRaw === 'string' && proxyRefRaw.trim().length > 0 ? proxyRefRaw : null;

		// design.md 4.0.2節: 「元にしたバージョン」は任意。選んだ場合のみ関係の種類も必須にする
		let derivedFrom = null;
		if (typeof derivedFromVersionIdRaw === 'string' && derivedFromVersionIdRaw.length > 0) {
			if (!isDerivedFromRelation(derivedFromRelationRaw)) {
				return fail(400, { message: m.error_derived_from_relation_required() });
			}
			derivedFrom = { versionId: derivedFromVersionIdRaw, relation: derivedFromRelationRaw };
		}

		const result = await submitVersion(locals.db, {
			titleId: params.titleId,
			cutId: params.cutId,
			representationType,
			processStep,
			fileRef,
			proxyRef,
			artifactMetadata: null,
			derivedFrom,
			submittedBy: locals.currentPerson.id,
		});
		if (!result.ok) {
			const message =
				result.error.kind === 'derived_from_version_not_found'
					? m.error_derived_from_not_found()
					: result.error.kind === 'representation_type_disabled'
						? m.error_representation_type_disabled()
						: m.error_submit_version_failed();
			return fail(400, { message });
		}

		return { success: true };
	},

	submitReview: async ({ request, params, locals }) => {
		if (!locals.currentPerson) return fail(401, { message: m.error_login_required() });
		if (!canWorkspaceRole(locals.currentPerson.workspaceRole, 'manageProduction')) {
			return fail(403, { message: m.error_no_permission_review() });
		}

		const formData = await request.formData();
		const versionId = formData.get('versionId');
		const reviewResult = formData.get('result');
		const commentRaw = formData.get('comment');

		if (typeof versionId !== 'string' || versionId.length === 0) {
			return fail(400, { message: m.error_invalid_request() });
		}
		if (!isReviewResult(reviewResult)) {
			return fail(400, { message: m.error_review_result_required() });
		}
		const comment =
			typeof commentRaw === 'string' && commentRaw.trim().length > 0 ? commentRaw : null;

		const result = await submitReview(locals.db, {
			cutId: params.cutId,
			versionId,
			reviewerId: locals.currentPerson.id,
			result: reviewResult,
			comment,
		});
		if (!result.ok) return fail(400, { message: m.error_submit_review_failed() });

		return { success: true };
	},

	sealVersion: async ({ request, params, locals }) => {
		if (!locals.currentPerson) return fail(401, { message: m.error_login_required() });
		// design.md 8.2節: Seal操作はadminのみ
		if (!canWorkspaceRole(locals.currentPerson.workspaceRole, 'manageProduction')) {
			return fail(403, { message: m.error_no_permission_seal() });
		}

		const formData = await request.formData();
		const versionId = formData.get('versionId');
		const representationId = formData.get('representationId');
		if (
			typeof versionId !== 'string' ||
			versionId.length === 0 ||
			typeof representationId !== 'string' ||
			representationId.length === 0
		) {
			return fail(400, { message: m.error_invalid_request() });
		}

		const result = await sealVersion(locals.db, {
			cutId: params.cutId,
			representationId,
			versionId,
			sealedBy: locals.currentPerson.id,
		});
		if (!result.ok) return fail(400, { message: m.error_seal_failed() });

		return { success: true };
	},

	recordGateEvidence: async ({ request, params, locals }) => {
		if (!locals.currentPerson) return fail(401, { message: m.error_login_required() });
		if (!canWorkspaceRole(locals.currentPerson.workspaceRole, 'manageProduction')) {
			return fail(403, { message: m.error_no_permission_review() });
		}
		const formData = await request.formData();
		const gateId = formData.get('gateId');
		const versionId = formData.get('versionId');
		const result = formData.get('result');
		if (
			typeof gateId !== 'string' ||
			gateId.length === 0 ||
			typeof versionId !== 'string' ||
			versionId.length === 0 ||
			(result !== 'passed' && result !== 'returned')
		) {
			return fail(400, { message: m.error_invalid_request() });
		}
		const recorded = await recordGateEvidence(locals.db, {
			titleId: params.titleId,
			cutId: params.cutId,
			gateId,
			versionId,
			reviewerId: locals.currentPerson.id,
			result,
		});
		if (!recorded.ok) return fail(400, { message: m.error_submit_review_failed() });
		return { success: true };
	},
};
