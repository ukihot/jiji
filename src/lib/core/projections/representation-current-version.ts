import type { RepresentationEvent } from '../representation';

/**
 * design.md 4.1節 representation_current_version のproject関数。
 * event 1件と現在の投影行から、次の投影行を計算する（membership-state.tsと同型）。
 *
 * 「最新版」（latestVersionId）はVersionSubmittedで、「採用版」（approvedVersionId）は
 * VersionSealedだけで更新する。ReviewSubmittedはどちらも更新しない——レビューの判断
 * （承認/差し戻し）と、作品に採用する版を確定させるSealは別の行為だから（design.md 6.2節）。
 */

export interface RepresentationCurrentVersionRow {
	representationId: string;
	latestVersionId: string;
	approvedVersionId: string | null;
}

export function projectRepresentationCurrentVersion(
	event: RepresentationEvent,
	current: RepresentationCurrentVersionRow | null,
): RepresentationCurrentVersionRow | null {
	switch (event.type) {
		case 'RepresentationCreated':
			// Versionを伴わないRepresentation単体の作成は投影行を持たない
			return current;

		case 'VersionSubmitted':
			return {
				representationId: event.payload.representationId,
				latestVersionId: event.payload.versionId,
				approvedVersionId: current?.approvedVersionId ?? null,
			};

		case 'ReviewSubmitted':
			// Reviewは採用版を確定させない（Sealの役割）
			return current;

		case 'VersionSealed':
			if (!current) {
				// VersionSealedはそのRepresentationに少なくとも1つVersionSubmittedがあって初めて起こりうる
				throw new Error(
					'VersionSealed event has no prior representation_current_version projection',
				);
			}
			return { ...current, approvedVersionId: event.payload.versionId };
	}
}
