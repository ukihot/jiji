/**
 * drizzle-kit push/migrate/studio は better-sqlite3 / @libsql/client のネイティブバインディングを
 * 必要とするが、この環境ではロード時にsegfaultして使えない（Windows特有の既知の問題）。
 * `bun run db:generate` 自体はスキーマの静的解析だけなので問題なく動く。
 *
 * このスクリプトは、db:generateが出力したSQLマイグレーションを、アプリ本体と同じ
 * bun:sqlite（ネイティブアドオン不要、Bun本体に同梱）で直接適用する。ローカル開発では
 * `bun run db:push` の代わりに `bun run db:apply` を使う。
 */
import { Database } from 'bun:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const databasePath = process.env.DATABASE_PATH ?? './local.db';
const migrationsDir = join(import.meta.dir, '..', 'drizzle');

const sqlFiles = readdirSync(migrationsDir)
	.filter((file) => file.endsWith('.sql'))
	.sort();

if (sqlFiles.length === 0) {
	console.error('drizzle/ にSQLマイグレーションが見つかりません。先に `bun run db:generate` を実行してください。');
	process.exit(1);
}

const sqlite = new Database(databasePath, { create: true });
sqlite.run('PRAGMA foreign_keys = ON;');

for (const file of sqlFiles) {
	const raw = readFileSync(join(migrationsDir, file), 'utf-8');
	const statements = raw
		.split('--> statement-breakpoint')
		.map((statement) => statement.trim())
		.filter((statement) => statement.length > 0);

	console.log(`適用中: ${file}（${statements.length}文）`);
	for (const statement of statements) {
		sqlite.run(statement);
	}
}

console.log(`✓ ${sqlFiles.length}件のマイグレーションを ${databasePath} に適用しました。`);
