import { and, asc, desc, eq } from 'drizzle-orm';
import { computeEventHash } from '$lib/core/event-hash';
import type { SqliteQueryable } from '../../db';
import { event as eventTable } from '../../db/schema';

/**
 * design.md 5章: eventは追記専用。このリポジトリはinsertとselectしか公開しない
 * （UPDATE/DELETEはそもそも用意しない。DB側のトリガーはdb/bootstrap.tsを参照）。
 */

export interface DomainEventToAppend {
	type: string;
	payload: unknown;
}

export interface AppendedEvent {
	id: string;
	targetType: string;
	targetId: string;
	type: string;
	payload: unknown;
	prevHash: string | null;
	hash: string;
	createdAt: Date;
}

async function getLatestHash(
	db: SqliteQueryable,
	targetType: string,
	targetId: string,
): Promise<string | null> {
	const rows = await db
		.select({ hash: eventTable.hash })
		.from(eventTable)
		.where(and(eq(eventTable.targetType, targetType), eq(eventTable.targetId, targetId)))
		.orderBy(desc(eventTable.createdAt))
		.limit(1);
	return rows[0]?.hash ?? null;
}

/**
 * design.md 5章のハッシュチェーンを1件追記する。
 * prevHashは同じ(targetType, targetId)の直前のイベントから取る（タイムライン単位のチェーン）。
 */
export async function appendEvent(
	db: SqliteQueryable,
	targetType: string,
	targetId: string,
	domainEvent: DomainEventToAppend,
	now: Date,
): Promise<AppendedEvent> {
	const prevHash = await getLatestHash(db, targetType, targetId);
	const hash = computeEventHash(prevHash, {
		type: domainEvent.type,
		payload: domainEvent.payload,
		createdAt: now,
	});
	const id = crypto.randomUUID();
	await db.insert(eventTable).values({
		id,
		targetType,
		targetId,
		type: domainEvent.type,
		payload: domainEvent.payload,
		prevHash,
		hash,
		createdAt: now,
	});
	return {
		id,
		targetType,
		targetId,
		type: domainEvent.type,
		payload: domainEvent.payload,
		prevHash,
		hash,
		createdAt: now,
	};
}

/** 複数イベントを同じ(targetType, targetId)ストリームに順番に追記する */
export async function appendEvents(
	db: SqliteQueryable,
	targetType: string,
	targetId: string,
	domainEvents: readonly DomainEventToAppend[],
	now: Date,
): Promise<AppendedEvent[]> {
	const appended: AppendedEvent[] = [];
	for (const domainEvent of domainEvents) {
		appended.push(await appendEvent(db, targetType, targetId, domainEvent, now));
	}
	return appended;
}

/** decide/evolveのためにあるストリームの全イベントを時系列順に取得する */
export async function getEventsByTarget(
	db: SqliteQueryable,
	targetType: string,
	targetId: string,
): Promise<AppendedEvent[]> {
	const rows = await db
		.select()
		.from(eventTable)
		.where(and(eq(eventTable.targetType, targetType), eq(eventTable.targetId, targetId)))
		.orderBy(asc(eventTable.createdAt));
	return rows.map((row) => ({
		id: row.id,
		targetType: row.targetType,
		targetId: row.targetId,
		type: row.type,
		payload: row.payload,
		prevHash: row.prevHash,
		hash: row.hash,
		createdAt: row.createdAt,
	}));
}

/** 監査画面用。対象を横断して最新のイベントを取得する（eventは追記専用）。 */
export async function listRecentEvents(db: SqliteQueryable, limit = 200): Promise<AppendedEvent[]> {
	const rows = await db.select().from(eventTable).orderBy(desc(eventTable.createdAt)).limit(limit);
	return rows.map((row) => ({
		id: row.id,
		targetType: row.targetType,
		targetId: row.targetId,
		type: row.type,
		payload: row.payload,
		prevHash: row.prevHash,
		hash: row.hash,
		createdAt: row.createdAt,
	}));
}
