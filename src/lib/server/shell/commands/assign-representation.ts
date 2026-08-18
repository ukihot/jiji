import { REPRESENTATION_TYPES, type RepresentationType } from '$lib/core/representation';
import type { SqliteDb } from '../../db';
import { appendEvent } from '../repository/event-repository';
import { getRepresentationByType, insertRepresentation } from '../repository/production-repository';
import { replaceWorkAssignment } from '../repository/work-assignment-repository';

/** 未提出の工程にも担当者を置けるよう、割当時にRepresentationを実体化する。 */
export async function assignRepresentation(
	db: SqliteDb,
	input: {
		cutId: string;
		type: RepresentationType;
		assigneeId: string;
		assignedBy: string;
	},
): Promise<void> {
	const now = new Date();
	await db.transaction(async (tx) => {
		let representation = await getRepresentationByType(tx, input.cutId, input.type);
		if (!representation) {
			representation = {
				id: crypto.randomUUID(),
				cutId: input.cutId,
				type: input.type,
				sortOrder: REPRESENTATION_TYPES.indexOf(input.type),
			};
			await appendEvent(
				tx,
				'cut',
				input.cutId,
				{
					type: 'RepresentationCreated',
					payload: {
						representationId: representation.id,
						cutId: input.cutId,
						representationType: input.type,
						sortOrder: representation.sortOrder,
					},
				},
				now,
			);
			await insertRepresentation(tx, representation);
		}
		await appendEvent(
			tx,
			'work-assignment',
			`representation:${representation.id}`,
			{
				type: 'WorkAssigned',
				payload: { ...input, targetId: representation.id, assignedAt: now.toISOString() },
			},
			now,
		);
		await replaceWorkAssignment(tx, {
			id: crypto.randomUUID(),
			targetType: 'representation',
			targetId: representation.id,
			assigneeId: input.assigneeId,
			assignedAt: now,
		});
	});
}
