import { and, asc, desc, eq, isNull, lt, or } from 'drizzle-orm';
import type { RelayStorageProvider } from '$lib/core/relay';
import type { SqliteQueryable } from '../../db';
import {
	person,
	relayRegistration,
	relayStorageConnection,
	relayTransferAttempt,
	relayTransferJob,
	title,
} from '../../db/schema';

export interface RelayStorageConnectionRow {
	id: string;
	titleId: string;
	provider: RelayStorageProvider;
	endpoint: string | null;
	region: string | null;
	bucketOrContainer: string;
	prefix: string;
	authRef: string;
	/** サーバー側でのみ読む実鍵。ブラウザへは絶対にシリアライズしない。 */
	accessKeyId: string | null;
	secretAccessKey: string | null;
	enabled: boolean;
	createdBy: string;
	createdAt: Date;
}

/** Browserへシリアライズしてよい接続情報。secret参照名・実鍵は含めない。 */
export type PublicRelayStorageConnectionRow = Omit<
	RelayStorageConnectionRow,
	'authRef' | 'accessKeyId' | 'secretAccessKey'
>;

export interface RelayRegistrationRow {
	id: string;
	titleId: string;
	storageConnectionId: string;
	browserInstanceId: string;
	displayName: string;
	registeredBy: string;
	allowedRootKey: string;
	writable: boolean;
	lastHeartbeatAt: Date | null;
	lastErrorCode: string | null;
	createdAt: Date;
}

export async function getRelayStorageConnection(
	db: SqliteQueryable,
	connectionId: string,
): Promise<RelayStorageConnectionRow | null> {
	const rows = await db
		.select()
		.from(relayStorageConnection)
		.where(eq(relayStorageConnection.id, connectionId));
	return rows[0] ?? null;
}

export async function listRelayStorageConnections(
	db: SqliteQueryable,
	titleId: string,
): Promise<Array<PublicRelayStorageConnectionRow & { hasCredentials: boolean }>> {
	const rows = await db
		.select({
			id: relayStorageConnection.id,
			titleId: relayStorageConnection.titleId,
			provider: relayStorageConnection.provider,
			endpoint: relayStorageConnection.endpoint,
			region: relayStorageConnection.region,
			bucketOrContainer: relayStorageConnection.bucketOrContainer,
			prefix: relayStorageConnection.prefix,
			enabled: relayStorageConnection.enabled,
			createdBy: relayStorageConnection.createdBy,
			createdAt: relayStorageConnection.createdAt,
			accessKeyId: relayStorageConnection.accessKeyId,
		})
		.from(relayStorageConnection)
		.where(eq(relayStorageConnection.titleId, titleId))
		.orderBy(desc(relayStorageConnection.createdAt));
	// accessKeyIdの値自体はブラウザへ返さず、設定済みかどうかのbooleanだけに落とす。
	return rows.map(({ accessKeyId, ...rest }) => ({
		...rest,
		hasCredentials: accessKeyId !== null,
	}));
}

export async function listAvailableRelayStorageConnections(
	db: SqliteQueryable,
): Promise<Array<PublicRelayStorageConnectionRow & { titleName: string }>> {
	return db
		.select({
			id: relayStorageConnection.id,
			titleId: relayStorageConnection.titleId,
			provider: relayStorageConnection.provider,
			endpoint: relayStorageConnection.endpoint,
			region: relayStorageConnection.region,
			bucketOrContainer: relayStorageConnection.bucketOrContainer,
			prefix: relayStorageConnection.prefix,
			enabled: relayStorageConnection.enabled,
			createdBy: relayStorageConnection.createdBy,
			createdAt: relayStorageConnection.createdAt,
			titleName: title.name,
		})
		.from(relayStorageConnection)
		.innerJoin(title, eq(title.id, relayStorageConnection.titleId))
		.where(eq(relayStorageConnection.enabled, true))
		.orderBy(asc(title.name), asc(relayStorageConnection.createdAt));
}

export async function insertRelayStorageConnection(
	db: SqliteQueryable,
	row: RelayStorageConnectionRow,
): Promise<void> {
	await db.insert(relayStorageConnection).values(row);
}

/** 資格情報だけを後から設定・更新する。フォーム入力値は書き込み専用でこの先読み返さない。 */
export async function updateRelayStorageCredentials(
	db: SqliteQueryable,
	connectionId: string,
	accessKeyId: string,
	secretAccessKey: string,
): Promise<void> {
	await db
		.update(relayStorageConnection)
		.set({ accessKeyId, secretAccessKey })
		.where(eq(relayStorageConnection.id, connectionId));
}

export async function getRelayRegistration(
	db: SqliteQueryable,
	relayId: string,
): Promise<RelayRegistrationRow | null> {
	const rows = await db.select().from(relayRegistration).where(eq(relayRegistration.id, relayId));
	return rows[0] ?? null;
}

export async function getRelayRegistrationByBrowser(
	db: SqliteQueryable,
	titleId: string,
	browserInstanceId: string,
): Promise<RelayRegistrationRow | null> {
	const rows = await db
		.select()
		.from(relayRegistration)
		.where(
			and(
				eq(relayRegistration.titleId, titleId),
				eq(relayRegistration.browserInstanceId, browserInstanceId),
			),
		);
	return rows[0] ?? null;
}

export async function insertRelayRegistration(
	db: SqliteQueryable,
	row: RelayRegistrationRow,
): Promise<void> {
	await db.insert(relayRegistration).values(row);
}

export async function updateRelayRegistration(
	db: SqliteQueryable,
	relayId: string,
	values: Pick<
		RelayRegistrationRow,
		| 'storageConnectionId'
		| 'displayName'
		| 'allowedRootKey'
		| 'writable'
		| 'lastHeartbeatAt'
		| 'lastErrorCode'
	>,
): Promise<void> {
	await db.update(relayRegistration).set(values).where(eq(relayRegistration.id, relayId));
}

export async function listRelayRegistrations(
	db: SqliteQueryable,
	titleId: string,
): Promise<Array<RelayRegistrationRow & { personName: string }>> {
	return db
		.select({
			id: relayRegistration.id,
			titleId: relayRegistration.titleId,
			storageConnectionId: relayRegistration.storageConnectionId,
			browserInstanceId: relayRegistration.browserInstanceId,
			displayName: relayRegistration.displayName,
			registeredBy: relayRegistration.registeredBy,
			allowedRootKey: relayRegistration.allowedRootKey,
			writable: relayRegistration.writable,
			lastHeartbeatAt: relayRegistration.lastHeartbeatAt,
			lastErrorCode: relayRegistration.lastErrorCode,
			createdAt: relayRegistration.createdAt,
			personName: person.name,
		})
		.from(relayRegistration)
		.innerJoin(person, eq(person.id, relayRegistration.registeredBy))
		.where(eq(relayRegistration.titleId, titleId))
		.orderBy(asc(relayRegistration.displayName));
}

export async function countPendingRelayJobs(db: SqliteQueryable, titleId: string): Promise<number> {
	const rows = await db
		.select({ id: relayTransferJob.id })
		.from(relayTransferJob)
		.where(and(eq(relayTransferJob.titleId, titleId), eq(relayTransferJob.state, 'pending')));
	return rows.length;
}

export interface RelayTransferJobRow {
	id: string;
	titleId: string;
	storageConnectionId: string;
	sourceObjectKey: string;
	targetRelativePath: string;
	expectedSize: number;
	expectedSha256: string | null;
	state: 'pending' | 'leased' | 'delivered' | 'failed';
	deliveredSize: number | null;
	deliveredSha256: string | null;
	sharedFolderVerifiedAt: Date | null;
	sourceDeleteState: 'not_ready' | 'pending' | 'deleting' | 'deleted' | 'retryable_error';
	sourceDeletedAt: Date | null;
	sourceDeleteRetryCount: number;
	sourceDeleteLastErrorCode: string | null;
	retryCount: number;
	leaseUntil: Date | null;
	leasedRelayId: string | null;
	createdAt: Date;
}

export async function getRelayTransferJob(
	db: SqliteQueryable,
	jobId: string,
): Promise<RelayTransferJobRow | null> {
	const rows = await db.select().from(relayTransferJob).where(eq(relayTransferJob.id, jobId));
	return rows[0] ?? null;
}

export async function getRelayTransferJobBySourceKey(
	db: SqliteQueryable,
	storageConnectionId: string,
	sourceObjectKey: string,
): Promise<RelayTransferJobRow | null> {
	const rows = await db
		.select()
		.from(relayTransferJob)
		.where(
			and(
				eq(relayTransferJob.storageConnectionId, storageConnectionId),
				eq(relayTransferJob.sourceObjectKey, sourceObjectKey),
			),
		);
	return rows[0] ?? null;
}

export async function insertRelayTransferJob(
	db: SqliteQueryable,
	row: Pick<
		RelayTransferJobRow,
		| 'id'
		| 'titleId'
		| 'storageConnectionId'
		| 'sourceObjectKey'
		| 'targetRelativePath'
		| 'expectedSize'
		| 'expectedSha256'
		| 'createdAt'
	>,
): Promise<void> {
	await db.insert(relayTransferJob).values({ ...row, state: 'pending' });
}

/** pendingか、lease切れのjobだけを対象にする。design.md 9.6.6の条件付きclaim。 */
export async function listClaimableRelayTransferJobs(
	db: SqliteQueryable,
	storageConnectionId: string,
	now: Date,
): Promise<RelayTransferJobRow[]> {
	return db
		.select()
		.from(relayTransferJob)
		.where(
			and(
				eq(relayTransferJob.storageConnectionId, storageConnectionId),
				or(
					eq(relayTransferJob.state, 'pending'),
					and(eq(relayTransferJob.state, 'leased'), lt(relayTransferJob.leaseUntil, now)),
					and(eq(relayTransferJob.state, 'leased'), isNull(relayTransferJob.leaseUntil)),
				),
			),
		);
}

export async function markRelayTransferJobLeased(
	db: SqliteQueryable,
	jobId: string,
	relayId: string,
	leaseUntil: Date,
): Promise<void> {
	await db
		.update(relayTransferJob)
		.set({ state: 'leased', leasedRelayId: relayId, leaseUntil })
		.where(eq(relayTransferJob.id, jobId));
}

export async function markRelayTransferJobDelivered(
	db: SqliteQueryable,
	jobId: string,
	values: { deliveredSize: number; deliveredSha256: string; sharedFolderVerifiedAt: Date },
): Promise<void> {
	await db
		.update(relayTransferJob)
		.set({ state: 'delivered', sourceDeleteState: 'pending', ...values })
		.where(eq(relayTransferJob.id, jobId));
}

export async function markRelayTransferJobFailed(
	db: SqliteQueryable,
	jobId: string,
): Promise<void> {
	await db
		.update(relayTransferJob)
		.set({ state: 'failed', leasedRelayId: null, leaseUntil: null })
		.where(eq(relayTransferJob.id, jobId));
}

export async function markRelaySourceDeleted(db: SqliteQueryable, jobId: string): Promise<void> {
	await db
		.update(relayTransferJob)
		.set({ sourceDeleteState: 'deleted', sourceDeletedAt: new Date() })
		.where(eq(relayTransferJob.id, jobId));
}

export async function markRelaySourceDeleteRetryable(
	db: SqliteQueryable,
	jobId: string,
	errorCode: string,
	retryCount: number,
): Promise<void> {
	await db
		.update(relayTransferJob)
		.set({
			sourceDeleteState: 'retryable_error',
			sourceDeleteLastErrorCode: errorCode,
			sourceDeleteRetryCount: retryCount,
		})
		.where(eq(relayTransferJob.id, jobId));
}

export async function insertRelayTransferAttempt(
	db: SqliteQueryable,
	row: {
		id: string;
		jobId: string;
		relayId: string;
		leaseToken: string;
		result: 'started' | 'delivered' | 'retryable_error' | 'terminal_error';
		actualSize: number | null;
		actualSha256: string | null;
		errorCode: string | null;
		createdAt: Date;
	},
): Promise<void> {
	await db.insert(relayTransferAttempt).values(row);
}
