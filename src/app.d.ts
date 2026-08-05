/// <reference types="@cloudflare/workers-types" />
// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SqliteDb } from '$lib/server/db';
import type { CurrentPerson } from '$lib/server/auth/internal';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** 今回はSQLiteパスのみ実装（db/index.tsのコメント参照） */
			db: SqliteDb;
			/** design.md 8.4節: 開発用スタブ認証で選ばれている「今の自分」。未ログインならnull */
			currentPerson: CurrentPerson | null;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			/** design.md 1.1節: ホスティングSaaS（Cloudflare Workers）実行時にだけ存在するD1バインディング */
			env?: {
				DB?: D1Database;
			};
		}
	}
}

export {};
