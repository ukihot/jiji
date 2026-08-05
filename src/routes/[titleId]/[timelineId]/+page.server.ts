import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { SharePermissionLevel } from '$lib/core/share-link';
import { addCut } from '$lib/server/shell/commands/add-cut';
import { createShareLink } from '$lib/server/shell/commands/create-share-link';
import { revokeShareLink } from '$lib/server/shell/commands/revoke-share-link';
import { hasAtLeast } from '$lib/server/shell/authorization';
import { getTimelineView } from '$lib/server/shell/queries/get-timeline-view';
import { listShareLinksForCuts } from '$lib/server/shell/queries/list-share-links';

export const load: PageServerLoad = async ({ params, locals }) => {
	const view = await getTimelineView(locals.db, params.titleId, params.timelineId);
	if (!view) error(404, 'タイムラインが見つかりません');

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
		if (!locals.currentPerson) return fail(401, { message: 'ログインしてください' });
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
			return fail(403, { message: 'この話数にカットを追加する権限がありません' });
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
			return fail(400, { message: 'カット番号を入力してください' });
		}
		if (!Number.isInteger(sortOrder)) {
			return fail(400, { message: '並び順は整数で入力してください' });
		}
		if (!Number.isFinite(plannedFrames) || plannedFrames <= 0) {
			return fail(400, { message: '予定尺（コマ数）は1以上で入力してください' });
		}

		const result = await addCut(locals.db, {
			timelineId: params.timelineId,
			number,
			sortOrder,
			plannedFrames,
			sceneTags,
		});
		if (!result.ok) {
			return fail(400, {
				message: 'カットを追加できませんでした（番号か並び順が重複している可能性があります）',
			});
		}

		return { success: true };
	},

	createShareLink: async ({ request, params, locals }) => {
		if (!locals.currentPerson) return fail(401, { message: 'ログインしてください' });
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
			return fail(403, { message: '共有リンクの発行にはこの作品の管理者権限が必要です' });
		}

		const formData = await request.formData();
		const cutIds = formData
			.getAll('cutIds')
			.filter((value): value is string => typeof value === 'string');
		const permissionLevelRaw = formData.get('permissionLevel');
		const expiresInDays = Number(formData.get('expiresInDays'));

		if (cutIds.length === 0) return fail(400, { message: '対象カットを1つ以上選んでください' });
		if (permissionLevelRaw !== 'viewer' && permissionLevelRaw !== 'contributor') {
			return fail(400, { message: '権限レベルを選んでください' });
		}
		const permissionLevel: SharePermissionLevel = permissionLevelRaw;
		if (!Number.isFinite(expiresInDays) || expiresInDays <= 0 || expiresInDays > 90) {
			return fail(400, { message: '有効期限は1〜90日で指定してください（design.md: 最長90日）' });
		}

		const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
		const result = await createShareLink(locals.db, {
			targetCutIds: cutIds,
			permissionLevel,
			createdBy: locals.currentPerson.id,
			expiresAt,
		});
		if (!result.ok) return fail(400, { message: '共有リンクを作成できませんでした' });

		const shareUrl = `${new URL(request.url).origin}/s/${result.token}`;
		return { success: true, shareLinkCreated: { url: shareUrl, expiresAt } };
	},

	revokeShareLink: async ({ request, params, locals }) => {
		if (!locals.currentPerson) return fail(401, { message: 'ログインしてください' });
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
			return fail(403, { message: '権限がありません' });
		}

		const formData = await request.formData();
		const shareLinkId = formData.get('shareLinkId');
		if (typeof shareLinkId !== 'string') return fail(400, { message: '不正なリクエストです' });

		const result = await revokeShareLink(locals.db, {
			shareLinkId,
			revokedBy: locals.currentPerson.id,
		});
		if (!result.ok) return fail(400, { message: '取り消せませんでした' });

		return { success: true };
	},
};
