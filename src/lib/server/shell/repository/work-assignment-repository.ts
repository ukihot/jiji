import { and, eq } from 'drizzle-orm';
import type { WorkTargetType } from '$lib/core/work-assignment';
import type { SqliteQueryable } from '../../db';
import { person, workAssignment } from '../../db/schema';

export interface WorkAssignmentRow {
	id: string;
	targetType: WorkTargetType;
	targetId: string;
	assigneeId: string;
	assigneeName: string;
	assignedAt: Date;
}

export async function listWorkAssignments(db: SqliteQueryable): Promise<WorkAssignmentRow[]> {
	return db
		.select({
			id: workAssignment.id,
			targetType: workAssignment.targetType,
			targetId: workAssignment.targetId,
			assigneeId: workAssignment.assigneeId,
			assigneeName: person.name,
			assignedAt: workAssignment.assignedAt,
		})
		.from(workAssignment)
		.innerJoin(person, eq(person.id, workAssignment.assigneeId));
}

export async function getWorkAssignment(
	db: SqliteQueryable,
	targetType: WorkTargetType,
	targetId: string,
): Promise<WorkAssignmentRow | null> {
	const rows = await listWorkAssignmentsForTarget(db, targetType, targetId);
	return rows[0] ?? null;
}

export async function listWorkAssignmentsForTarget(
	db: SqliteQueryable,
	targetType: WorkTargetType,
	targetId: string,
): Promise<WorkAssignmentRow[]> {
	return db
		.select({
			id: workAssignment.id,
			targetType: workAssignment.targetType,
			targetId: workAssignment.targetId,
			assigneeId: workAssignment.assigneeId,
			assigneeName: person.name,
			assignedAt: workAssignment.assignedAt,
		})
		.from(workAssignment)
		.innerJoin(person, eq(person.id, workAssignment.assigneeId))
		.where(and(eq(workAssignment.targetType, targetType), eq(workAssignment.targetId, targetId)));
}

export async function replaceWorkAssignment(
	db: SqliteQueryable,
	row: Omit<WorkAssignmentRow, 'assigneeName'>,
): Promise<void> {
	const existing = await getWorkAssignment(db, row.targetType, row.targetId);
	if (existing) {
		await db
			.update(workAssignment)
			.set({
				assigneeId: row.assigneeId,
				assignedAt: row.assignedAt,
			})
			.where(eq(workAssignment.id, existing.id));
		return;
	}
	await db.insert(workAssignment).values(row);
}
