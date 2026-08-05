import { defineConfig } from 'drizzle-kit';

// design.md 1.1節「ホスティングSaaS（将来・任意）」モード用の設定。
// 通常のローカル開発は drizzle.config.ts（SQLite）を使う。D1向けにmigrationを
// 生成・適用するときだけ `--config drizzle.config.d1.ts` を明示して使う。
if (!process.env.CLOUDFLARE_ACCOUNT_ID) throw new Error('CLOUDFLARE_ACCOUNT_ID is not set');
if (!process.env.CLOUDFLARE_DATABASE_ID) throw new Error('CLOUDFLARE_DATABASE_ID is not set');
if (!process.env.CLOUDFLARE_D1_TOKEN) throw new Error('CLOUDFLARE_D1_TOKEN is not set');

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	driver: 'd1-http',
	dbCredentials: {
		accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
		databaseId: process.env.CLOUDFLARE_DATABASE_ID,
		token: process.env.CLOUDFLARE_D1_TOKEN
	},
	verbose: true,
	strict: true
});
