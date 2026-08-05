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
