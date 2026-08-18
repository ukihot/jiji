import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type {
	BlueprintEdge,
	BlueprintNode,
	CapabilityKey,
	ProcessEdgeRelation,
} from '$lib/core/production-kernel';
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
	reviewGate,
	seal,
	submission,
	processEdge,
	processNode,
	productionBlueprint,
	studioTerm,
	gateEvidence,
	titleRepresentationType,
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

export async function getRepresentationByType(
	db: SqliteQueryable,
	cutId: string,
	type: RepresentationType,
): Promise<RepresentationRow | null> {
	const rows = await db.select().from(representation).where(eq(representation.cutId, cutId));
	return rows.find((row) => row.type === type) ?? null;
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

// ---- title_representation_type（投影。design.md 4.0.2節改訂: プロジェクトごとのRepresentation設定） ----

export async function listEnabledRepresentationTypes(
	db: SqliteQueryable,
	titleId: string,
): Promise<RepresentationType[]> {
	const rows = await db
		.select({ type: titleRepresentationType.type })
		.from(titleRepresentationType)
		.where(eq(titleRepresentationType.titleId, titleId));
	return rows.map((row) => row.type);
}

/** 設定は常にフルセットで置き換える（差分ではない）。既存行を全消しして選ばれた分だけ入れ直す */
export async function replaceEnabledRepresentationTypes(
	db: SqliteQueryable,
	titleId: string,
	types: readonly RepresentationType[],
): Promise<void> {
	await db.delete(titleRepresentationType).where(eq(titleRepresentationType.titleId, titleId));
	for (const type of types) {
		await db.insert(titleRepresentationType).values({ titleId, type });
	}
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

// ---- Production Kernel（design.md 11章） ----

export interface ProductionBlueprintRow {
	id: string;
	titleId: string;
	version: number;
	status: 'draft' | 'published' | 'retired';
	basedOnBlueprintId: string | null;
	publishedAt: Date | null;
	createdAt: Date;
}

export async function getPublishedBlueprint(
	db: SqliteQueryable,
	titleId: string,
): Promise<ProductionBlueprintRow | null> {
	const rows = await db
		.select()
		.from(productionBlueprint)
		.where(
			and(eq(productionBlueprint.titleId, titleId), eq(productionBlueprint.status, 'published')),
		)
		.orderBy(desc(productionBlueprint.version))
		.limit(1);
	return rows[0] ?? null;
}

export async function getNextBlueprintVersion(
	db: SqliteQueryable,
	titleId: string,
): Promise<number> {
	const rows = await db
		.select({ version: productionBlueprint.version })
		.from(productionBlueprint)
		.where(eq(productionBlueprint.titleId, titleId))
		.orderBy(desc(productionBlueprint.version))
		.limit(1);
	return (rows[0]?.version ?? 0) + 1;
}

export async function insertProductionBlueprint(
	db: SqliteQueryable,
	row: ProductionBlueprintRow,
): Promise<void> {
	await db.insert(productionBlueprint).values(row);
}

/** 公開済みBlueprintは常に一つ。過去版は消さず retired として再生可能に残す。 */
export async function retirePublishedBlueprints(
	db: SqliteQueryable,
	titleId: string,
): Promise<void> {
	await db
		.update(productionBlueprint)
		.set({ status: 'retired' })
		.where(
			and(eq(productionBlueprint.titleId, titleId), eq(productionBlueprint.status, 'published')),
		);
}

export async function insertProcessNodes(
	db: SqliteQueryable,
	blueprintId: string,
	nodes: readonly BlueprintNode[],
): Promise<void> {
	for (const node of nodes) {
		await db.insert(processNode).values({ ...node, blueprintId });
	}
}

export async function insertProcessEdges(
	db: SqliteQueryable,
	blueprintId: string,
	edges: readonly (BlueprintEdge & { id: string })[],
): Promise<void> {
	for (const edge of edges) await db.insert(processEdge).values({ ...edge, blueprintId });
}

export interface ProcessNodeRow extends BlueprintNode {
	blueprintId: string;
}

export interface ProcessEdgeRow {
	id: string;
	blueprintId: string;
	fromNodeId: string;
	toNodeId: string;
	relation: ProcessEdgeRelation;
}

export async function listProcessNodes(
	db: SqliteQueryable,
	blueprintId: string,
): Promise<ProcessNodeRow[]> {
	const rows = await db
		.select()
		.from(processNode)
		.where(eq(processNode.blueprintId, blueprintId))
		.orderBy(asc(processNode.sortHint));
	return rows.map((row) => ({ ...row, capabilityKey: row.capabilityKey as CapabilityKey }));
}

export async function listProcessEdges(
	db: SqliteQueryable,
	blueprintId: string,
): Promise<ProcessEdgeRow[]> {
	return db.select().from(processEdge).where(eq(processEdge.blueprintId, blueprintId));
}

export interface StudioTermRow {
	id: string;
	titleId: string;
	capabilityKey: CapabilityKey;
	displayName: string;
	aliases: string[];
	usageNote: string | null;
	activeFromEventId: string;
	retiredAt: Date | null;
}

export async function listActiveStudioTerms(
	db: SqliteQueryable,
	titleId: string,
): Promise<StudioTermRow[]> {
	const rows = await db
		.select()
		.from(studioTerm)
		.where(and(eq(studioTerm.titleId, titleId), sql`${studioTerm.retiredAt} IS NULL`));
	return rows.map((row) => ({ ...row, capabilityKey: row.capabilityKey as CapabilityKey }));
}

export async function insertStudioTerm(db: SqliteQueryable, row: StudioTermRow): Promise<void> {
	await db.insert(studioTerm).values(row);
}

export async function retireStudioTermsForCapability(
	db: SqliteQueryable,
	titleId: string,
	capabilityKey: CapabilityKey,
	now: Date,
): Promise<void> {
	await db
		.update(studioTerm)
		.set({ retiredAt: now })
		.where(
			and(
				eq(studioTerm.titleId, titleId),
				eq(studioTerm.capabilityKey, capabilityKey),
				sql`${studioTerm.retiredAt} IS NULL`,
			),
		);
}

export interface ReviewGateRow {
	id: string;
	processNodeId: string;
	gateKey: string;
	reviewerPolicy: string[];
	required: boolean;
}

export async function insertReviewGates(
	db: SqliteQueryable,
	rows: readonly ReviewGateRow[],
): Promise<void> {
	for (const row of rows) await db.insert(reviewGate).values(row);
}

export async function listReviewGatesForNodes(
	db: SqliteQueryable,
	nodeIds: readonly string[],
): Promise<ReviewGateRow[]> {
	if (nodeIds.length === 0) return [];
	return db
		.select()
		.from(reviewGate)
		.where(inArray(reviewGate.processNodeId, [...nodeIds]));
}

export interface GateEvidenceContextRow {
	gateId: string;
	processNodeId: string;
	titleId: string;
	representationType: RepresentationType | null;
	cutId: string;
}

/** ゲート記録時に、提出版が当該Cut・工程に属することを確認するための最小コンテキスト。 */
export async function getGateEvidenceContext(
	db: SqliteQueryable,
	gateId: string,
	versionId: string,
): Promise<GateEvidenceContextRow | null> {
	const rows = await db
		.select({
			gateId: reviewGate.id,
			processNodeId: processNode.id,
			titleId: productionBlueprint.titleId,
			representationType: processNode.representationType,
			cutId: submission.cutId,
		})
		.from(reviewGate)
		.innerJoin(processNode, eq(processNode.id, reviewGate.processNodeId))
		.innerJoin(productionBlueprint, eq(productionBlueprint.id, processNode.blueprintId))
		.innerJoin(version, eq(version.id, versionId))
		.innerJoin(submission, eq(submission.id, version.submissionId))
		.innerJoin(representation, eq(representation.id, submission.representationId))
		.where(and(eq(reviewGate.id, gateId), eq(processNode.representationType, representation.type)))
		.limit(1);
	return rows[0] ?? null;
}

export interface GateEvidenceRow {
	id: string;
	gateId: string;
	versionId: string;
	versionHash: string;
	reviewerId: string;
	result: 'passed' | 'returned';
	recordedAt: Date;
}

export async function insertGateEvidence(db: SqliteQueryable, row: GateEvidenceRow): Promise<void> {
	await db.insert(gateEvidence).values(row);
}

export async function listGateEvidenceForGates(
	db: SqliteQueryable,
	gateIds: readonly string[],
): Promise<GateEvidenceRow[]> {
	if (gateIds.length === 0) return [];
	return db
		.select()
		.from(gateEvidence)
		.where(inArray(gateEvidence.gateId, [...gateIds]))
		.orderBy(desc(gateEvidence.recordedAt));
}
