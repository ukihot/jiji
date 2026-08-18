import { sql } from 'drizzle-orm';
import type { SqliteDb } from './index';

/**
 * design.md 5章: `event`テーブルへのUPDATE/DELETEはDBトリガー（SQLite）またはD1側の制約で禁止する。
 * SQLite（セルフホストモード）側の実装。D1（ホスティングSaaS）側は別途D1の制約で対応する（design.md 9章 未決定事項）。
 * 起動のたびに冪等に実行してよいよう `CREATE TRIGGER IF NOT EXISTS` を使う。
 */
export async function ensureEventAppendOnlyTriggers(db: SqliteDb): Promise<void> {
	await db.run(sql`
		CREATE TRIGGER IF NOT EXISTS event_no_update
		BEFORE UPDATE ON event
		BEGIN
			SELECT RAISE(ABORT, 'event is append-only: UPDATE is not allowed');
		END
	`);
	await db.run(sql`
		CREATE TRIGGER IF NOT EXISTS event_no_delete
		BEFORE DELETE ON event
		BEGIN
			SELECT RAISE(ABORT, 'event is append-only: DELETE is not allowed');
		END
	`);
}

/**
 * design.md 4.0.2節: `version`もeventと同じ理由でINSERT-only（上書きはアプリ層でも禁止する）。
 * SQLite（セルフホストモード）側の実装。D1側は別途D1の制約で対応する（design.md 10章 未決定事項）。
 */
export async function ensureVersionAppendOnlyTriggers(db: SqliteDb): Promise<void> {
	await db.run(sql`
		CREATE TRIGGER IF NOT EXISTS version_no_update
		BEFORE UPDATE ON version
		BEGIN
			SELECT RAISE(ABORT, 'version is append-only: UPDATE is not allowed');
		END
	`);
	await db.run(sql`
		CREATE TRIGGER IF NOT EXISTS version_no_delete
		BEFORE DELETE ON version
		BEGIN
			SELECT RAISE(ABORT, 'version is append-only: DELETE is not allowed');
		END
	`);
}

/**
 * design.md 6.2節: `seal`も同じ理由でINSERT-only。封印記録そのものが書き換えられては
 * 改竄検知の基盤にならない。SQLite（セルフホストモード）側の実装。
 */
export async function ensureSealAppendOnlyTriggers(db: SqliteDb): Promise<void> {
	await db.run(sql`
		CREATE TRIGGER IF NOT EXISTS seal_no_update
		BEFORE UPDATE ON seal
		BEGIN
			SELECT RAISE(ABORT, 'seal is append-only: UPDATE is not allowed');
		END
	`);
	await db.run(sql`
		CREATE TRIGGER IF NOT EXISTS seal_no_delete
		BEFORE DELETE ON seal
		BEGIN
			SELECT RAISE(ABORT, 'seal is append-only: DELETE is not allowed');
		END
	`);
}

/** ゲート通過の根拠も監査可能な事実なので、訂正ではなく新しい証跡を追記する。 */
export async function ensureGateEvidenceAppendOnlyTriggers(db: SqliteDb): Promise<void> {
	await db.run(sql`
		CREATE TRIGGER IF NOT EXISTS gate_evidence_no_update
		BEFORE UPDATE ON gate_evidence
		BEGIN
			SELECT RAISE(ABORT, 'gate_evidence is append-only: UPDATE is not allowed');
		END
	`);
	await db.run(sql`
		CREATE TRIGGER IF NOT EXISTS gate_evidence_no_delete
		BEFORE DELETE ON gate_evidence
		BEGIN
			SELECT RAISE(ABORT, 'gate_evidence is append-only: DELETE is not allowed');
		END
	`);
}
