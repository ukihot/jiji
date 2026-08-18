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
	console.error(
		'drizzle/ にSQLマイグレーションが見つかりません。先に `bun run db:generate` を実行してください。',
	);
	process.exit(1);
}

const sqlite = new Database(databasePath, { create: true });
sqlite.run('PRAGMA foreign_keys = ON;');

// Drizzleのネイティブmigratorを使えない環境でも、同じSQLを二度流さないための履歴台帳。
// 既存の開発DB（この台帳より前に作られたもの）は、実テーブルの存在から一度だけ移行済み分を復元する。
sqlite.run(`
	CREATE TABLE IF NOT EXISTS __jiji_migrations (
		filename TEXT PRIMARY KEY NOT NULL,
		applied_at INTEGER NOT NULL
	)
`);

function tableExists(name: string): boolean {
	return Boolean(
		sqlite
			.query('SELECT 1 FROM sqlite_master WHERE type = ? AND name = ? LIMIT 1')
			.get('table', name),
	);
}

const existingHistory = sqlite.query('SELECT filename FROM __jiji_migrations').all() as Array<{
	filename: string;
}>;
if (existingHistory.length === 0) {
	const legacyApplied = tableExists('production_blueprint')
		? sqlFiles.filter((file) => file < '0006_')
		: tableExists('work_assignment')
			? sqlFiles.filter((file) => !file.startsWith('0005_'))
			: [];
	for (const file of legacyApplied) {
		sqlite.run(
			'INSERT OR IGNORE INTO __jiji_migrations (filename, applied_at) VALUES (?, ?)',
			file,
			Date.now(),
		);
	}
}

const applied = new Set(
	(sqlite.query('SELECT filename FROM __jiji_migrations').all() as Array<{ filename: string }>).map(
		(row) => row.filename,
	),
);
let appliedCount = 0;

for (const file of sqlFiles) {
	if (applied.has(file)) continue;
	const raw = readFileSync(join(migrationsDir, file), 'utf-8');
	const statements = raw
		.split('--> statement-breakpoint')
		.map((statement) => statement.trim())
		.filter((statement) => statement.length > 0);

	console.log(`適用中: ${file}（${statements.length}文）`);
	for (const statement of statements) {
		sqlite.run(statement);
	}
	sqlite.run(
		'INSERT INTO __jiji_migrations (filename, applied_at) VALUES (?, ?)',
		file,
		Date.now(),
	);
	appliedCount += 1;
}

console.log(`✓ ${appliedCount}件の未適用マイグレーションを ${databasePath} に適用しました。`);
