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
import { hasAtLeast, hasShareLinkContributorAccess } from '$lib/server/shell/authorization';
import { getCutEvolutionView } from '$lib/server/shell/queries/get-cut-evolution-view';

/**
 * design.md 8.5節/F-13: membership（社内・単話参加）に加え、Magic Identityの共有リンクだけを
 * 持つ外部作業者もこのcutへの提出ができるようにする（authorization.tsのhasShareLinkContributorAccess参照）。
 */
async function canSubmitVersion(
	locals: App.Locals,
	titleId: string,
	timelineId: string,
	cutId: string,
	now: Date,
): Promise<boolean> {
	if (!locals.currentPerson) return false;
	if (
		await hasAtLeast(locals.db, locals.currentPerson.id, titleId, 'contributor', now, timelineId)
	) {
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
	const canSubmit = await canSubmitVersion(
		locals,
		params.titleId,
		params.timelineId,
		params.cutId,
		now,
	);
	const canReview = locals.currentPerson
		? await hasAtLeast(
				locals.db,
				locals.currentPerson.id,
				params.titleId,
				'reviewer',
				now,
				params.timelineId,
			)
		: false;
	// design.md 8.2節: Seal操作はadminのみ（reviewerでも不可）
	const canSeal = locals.currentPerson
		? await hasAtLeast(
				locals.db,
				locals.currentPerson.id,
				params.titleId,
				'admin',
				now,
				params.timelineId,
			)
		: false;

	return { view, currentPerson: locals.currentPerson, canSubmit, canReview, canSeal };
};

export const actions: Actions = {
	submitVersion: async ({ request, params, locals }) => {
		if (!locals.currentPerson) return fail(401, { message: m.error_login_required() });
		if (
			!(await canSubmitVersion(locals, params.titleId, params.timelineId, params.cutId, new Date()))
		) {
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
		if (
			!(await hasAtLeast(
				locals.db,
				locals.currentPerson.id,
				params.titleId,
				'reviewer',
				new Date(),
				params.timelineId,
			))
		) {
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
};
