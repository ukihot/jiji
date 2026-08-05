import { asc, eq } from 'drizzle-orm';
import type {
	DerivedFromRelation,
	RepresentationType,
	ReviewResult,
} from '$lib/core/representation';
import type { RepresentationCurrentVersionRow } from '$lib/core/projections/representation-current-version';
import type { SqliteQueryable } from '../../db';
import {
	representation,
	representationCurrentVersion,
	review,
	seal,
	submission,
	version,
} from '../../db/schema';
import type { ProcessStatus } from './timeline-repository';

// ---- representation（design.md 4.0.2節） ----

export interface RepresentationRow {
	id: string;
	cutId: string;
	type: RepresentationType;
	sortOrder: number;
}

export async function insertRepresentation(
	db: SqliteQueryable,
	row: RepresentationRow,
): Promise<void> {
	await db.insert(representation).values(row);
}

export async function listRepresentationsByCut(
	db: SqliteQueryable,
	cutId: string,
): Promise<RepresentationRow[]> {
	return db
		.select()
		.from(representation)
		.where(eq(representation.cutId, cutId))
		.orderBy(asc(representation.sortOrder));
}

// ---- submission / version（design.md 4章。submission+versionは常に対で作られる） ----

export interface SubmissionRow {
	id: string;
	cutId: string;
	representationId: string;
	processStep: string;
	submittedBy: string;
	submittedAt: Date;
}

export async function insertSubmission(db: SqliteQueryable, row: SubmissionRow): Promise<void> {
	await db.insert(submission).values(row);
}

export interface VersionRow {
	id: string;
	submissionId: string;
	seq: number;
	fileRef: string;
	proxyRef: string | null;
	artifactMetadata: Record<string, unknown> | null;
	derivedFromVersionId: string | null;
	derivedFromRelation: DerivedFromRelation | null;
	createdAt: Date;
}

/** design.md 4.0.2節: UPDATE禁止・INSERTのみ（db/bootstrap.tsのトリガーでも強制） */
export async function insertVersion(db: SqliteQueryable, row: VersionRow): Promise<void> {
	await db.insert(version).values(row);
}

export async function getVersion(
	db: SqliteQueryable,
	versionId: string,
): Promise<VersionRow | null> {
	const rows = await db.select().from(version).where(eq(version.id, versionId));
	return rows[0] ?? null;
}

export interface VersionWithSubmissionRow extends VersionRow {
	processStep: string;
	submittedBy: string;
	submittedAt: Date;
}

/** Cut Evolution Viewer（design.md 7.5節）の1カラム分の版歴。seq昇順（＝提出順） */
export async function listVersionsByRepresentation(
	db: SqliteQueryable,
	representationId: string,
): Promise<VersionWithSubmissionRow[]> {
	const rows = await db
		.select({
			id: version.id,
			submissionId: version.submissionId,
			seq: version.seq,
			fileRef: version.fileRef,
			proxyRef: version.proxyRef,
			artifactMetadata: version.artifactMetadata,
			derivedFromVersionId: version.derivedFromVersionId,
			derivedFromRelation: version.derivedFromRelation,
			createdAt: version.createdAt,
			processStep: submission.processStep,
			submittedBy: submission.submittedBy,
			submittedAt: submission.submittedAt,
		})
		.from(version)
		.innerJoin(submission, eq(submission.id, version.submissionId))
		.where(eq(submission.representationId, representationId))
		.orderBy(asc(version.seq));
	return rows;
}

// ---- review（design.md 4章） ----

export interface ReviewRow {
	id: string;
	versionId: string;
	reviewerId: string;
	result: ReviewResult;
	comment: string | null;
	reviewedAt: Date;
}

export async function insertReview(db: SqliteQueryable, row: ReviewRow): Promise<void> {
	await db.insert(review).values(row);
}

export async function listReviewsByVersion(
	db: SqliteQueryable,
	versionId: string,
): Promise<ReviewRow[]> {
	return db
		.select()
		.from(review)
		.where(eq(review.versionId, versionId))
		.orderBy(asc(review.reviewedAt));
}

// ---- representation_current_version（投影。design.md 4.1節） ----

export async function getRepresentationCurrentVersion(
	db: SqliteQueryable,
	representationId: string,
): Promise<RepresentationCurrentVersionRow | null> {
	const rows = await db
		.select()
		.from(representationCurrentVersion)
		.where(eq(representationCurrentVersion.representationId, representationId));
	return rows[0] ?? null;
}

export async function upsertRepresentationCurrentVersion(
	db: SqliteQueryable,
	row: RepresentationCurrentVersionRow,
): Promise<void> {
	const existing = await getRepresentationCurrentVersion(db, row.representationId);
	if (existing) {
		await db
			.update(representationCurrentVersion)
			.set(row)
			.where(eq(representationCurrentVersion.representationId, row.representationId));
	} else {
		await db.insert(representationCurrentVersion).values(row);
	}
}

// ---- seal（design.md 4章/6.2節。Reviewとは別物） ----

export interface SealRow {
	id: string;
	versionId: string;
	hash: string;
	sealedBy: string;
	sealedAt: Date;
}

/** design.md 4.0.2節と同じ理由でINSERTのみ（db/bootstrap.tsのトリガーでも強制） */
export async function insertSeal(db: SqliteQueryable, row: SealRow): Promise<void> {
	await db.insert(seal).values(row);
}

export async function getSealByVersion(
	db: SqliteQueryable,
	versionId: string,
): Promise<SealRow | null> {
	const rows = await db.select().from(seal).where(eq(seal.versionId, versionId));
	// 同じVersionが複数回封印される想定はしていないが、万一あれば直近を返す
	return rows[rows.length - 1] ?? null;
}

export interface RepresentationWithCurrentVersion extends RepresentationRow {
	latestVersionId: string | null;
	approvedVersionId: string | null;
}

/** Cut Evolution Viewer: そのCutの全Representation × 現在の最新版/採用版を1回で読む */
export async function listRepresentationCurrentVersionsByCut(
	db: SqliteQueryable,
	cutId: string,
): Promise<RepresentationWithCurrentVersion[]> {
	const rows = await db
		.select({
			id: representation.id,
			cutId: representation.cutId,
			type: representation.type,
			sortOrder: representation.sortOrder,
			latestVersionId: representationCurrentVersion.latestVersionId,
			approvedVersionId: representationCurrentVersion.approvedVersionId,
		})
		.from(representation)
		.leftJoin(
			representationCurrentVersion,
			eq(representationCurrentVersion.representationId, representation.id),
		)
		.where(eq(representation.cutId, cutId))
		.orderBy(asc(representation.sortOrder));
	return rows.map((row) => ({
		...row,
		latestVersionId: row.latestVersionId ?? null,
		approvedVersionId: row.approvedVersionId ?? null,
	}));
}

/**
 * submit-version.ts / seal-version.ts共通: そのCutの全Representationの現在状態から
 * timeline_band_view.process_status（design.md 4.1節）を組み立てる。未提出のRepresentationは含めない。
 */
export function buildProcessStatus(
	currentVersions: readonly RepresentationWithCurrentVersion[],
): ProcessStatus {
	const submitted = currentVersions.filter(
		(row): row is typeof row & { latestVersionId: string } => row.latestVersionId !== null,
	);
	if (submitted.length === 0) return null;
	return Object.fromEntries(
		submitted.map((row) => [
			row.type,
			{ latestVersionId: row.latestVersionId, approvedVersionId: row.approvedVersionId },
		]),
	);
}
