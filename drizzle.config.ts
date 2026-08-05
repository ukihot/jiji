import { defineConfig } from 'drizzle-kit';

// design.md 1.1節「セルフホスト（既定）」モード用の設定。
// Cloudflare D1（ホスティングSaaS版）向けの設定は drizzle.config.d1.ts に分離してある。
const databasePath = process.env.DATABASE_PATH ?? './local.db';

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	dbCredentials: {
		url: databasePath
	},
	verbose: true,
	strict: true
});
