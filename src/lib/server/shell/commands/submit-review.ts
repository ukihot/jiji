import {
	REPRESENTATION_TYPES,
	decideRepresentation,
	evolveRepresentation,
	type RepresentationError,
	type RepresentationEvent,
	type ReviewResult,
} from '$lib/core/representation';
import type { SqliteDb } from '../../db';
import { appendEvents, getEventsByTarget } from '../repository/event-repository';
import { insertReview } from '../repository/production-repository';

export interface SubmitReviewInput {
	cutId: string;
	versionId: string;
	reviewerId: string;
	result: ReviewResult;
	comment: string | null;
}

export type SubmitReviewResult =
	| { ok: true; reviewId: string }
	| { ok: false; error: RepresentationError };

/** design.md 6.2節(Version)/design.md 4章(review): あるVersionへの確認・判断を記録する */
export async function submitReview(
	db: SqliteDb,
	input: SubmitReviewInput,
): Promise<SubmitReviewResult> {
	const reviewId = crypto.randomUUID();
	const now = new Date();

	return db.transaction(async (tx): Promise<SubmitReviewResult> => {
		const rawEvents = await getEventsByTarget(tx, 'cut', input.cutId);
		const events = rawEvents.map((row) => row as unknown as RepresentationEvent);
		const state = evolveRepresentation(events);

		const decision = decideRepresentation(
			{
				type: 'SubmitReview',
				reviewId,
				versionId: input.versionId,
				reviewerId: input.reviewerId,
				result: input.result,
				comment: input.comment,
			},
			state,
			// SubmitReviewのdecideはenabledTypesを参照しない（representation.tsのRepresentationContext参照）のでダミー値でよい
			{ now, enabledTypes: new Set(REPRESENTATION_TYPES) },
		);
		if (!decision.ok) return { ok: false, error: decision.error };

		await appendEvents(tx, 'cut', input.cutId, decision.events, now);
		await insertReview(tx, {
			id: reviewId,
			versionId: input.versionId,
			reviewerId: input.reviewerId,
			result: input.result,
			comment: input.comment,
			reviewedAt: now,
		});

		return { ok: true, reviewId };
	});
}
