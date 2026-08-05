import { createClient } from '@libsql/client';
import { drizzle as drizzleLibsql, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { drizzle as drizzleD1, type DrizzleD1Database } from 'drizzle-orm/d1';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from './schema';
import { ensureEventAppendOnlyTriggers } from './bootstrap';

export type Db = LibSQLDatabase<typeof schema> | DrizzleD1Database<typeof schema>;
/**
 * design.md 1.1節: セルフホスト（既定・SQLite）とホスティングSaaS（D1）を、
 * スキーマ・クエリコード無変更で両立させる。
 *
 * ローカルSQLiteは当初 `bun:sqlite`（同期ドライバ）を使っていたが、Vite/SvelteKitの
 * SSRモジュールグラフ経由で読み込むとNodeのESMローダーが`bun:`スキームを解決できず
 * 起動時エラーになった（`bun run dev`のトップレベルはBunでも、Viteの内部モジュール
 * ランナーはNode相当のローダーを経由するため）。そのため`@libsql/client`（非同期・
 * ネイティブアドオン不要）に切り替えている。D1も非同期ドライバなので、結果として
 * SqliteDb/D1どちらも'async'に統一され、Shell層は常に`await`する前提でよくなった。
 */
export type SqliteDb = LibSQLDatabase<typeof schema>;
/** repository層はこの型で受け取る。db本体からも`db.transaction(tx => ...)`のtxからも代入できる */
export type SqliteQueryable = BaseSQLiteDatabase<'async', unknown, typeof schema>;

let sqliteDb: SqliteDb | undefined;
let bootstrapped = false;

/**
 * `platform.env.DB`（Cloudflare Workers上のD1バインディング）があればD1を使い、
 * 無ければ（＝通常のローカル開発、またはセルフホスト実行）ローカルSQLiteファイルを使う。
 */
export async function getDb(platform?: App.Platform): Promise<Db> {
	const d1 = platform?.env?.DB;
	if (d1) {
		return drizzleD1(d1, { schema });
	}
	if (!sqliteDb) {
		const path = process.env.DATABASE_PATH ?? './local.db';
		const client = createClient({ url: `file:${path}` });
		sqliteDb = drizzleLibsql(client, { schema });
	}
	if (!bootstrapped) {
		await ensureEventAppendOnlyTriggers(sqliteDb);
		bootstrapped = true;
	}
	return sqliteDb;
}
