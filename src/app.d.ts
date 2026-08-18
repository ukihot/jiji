// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SqliteDb } from '$lib/server/db';
import type { CurrentPerson } from '$lib/server/auth/internal';

declare global {
	/**
	 * D1バインディングの最小限のアンビエント型。design.md 1.1節「ホスティングSaaS（D1）」用。
	 *
	 * 本来は`@cloudflare/workers-types`が提供するが、あのパッケージはグローバルの
	 * Request/Response/RequestInitをWorkers版に上書きしてしまい、paraglide-jsの生成コード
	 * （通常のDOM Requestを前提にしている）と型が衝突する。D1は今回まだ実接続しない
	 * （CLAUDE.md 8章参照）ので、drizzle-orm/d1が要求する最小限の形だけをここで宣言する。
	 * D1を実接続する段になったら、この宣言を`@cloudflare/workers-types`に置き換えるか、
	 * Request汚染を避ける形（例:サブパスimportでの型取得）に見直すこと。
	 */
	interface D1Database {
		prepare(query: string): D1PreparedStatement;
		batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
		exec(query: string): Promise<D1ExecResult>;
		dump(): Promise<ArrayBuffer>;
	}
	interface D1PreparedStatement {
		bind(...values: unknown[]): D1PreparedStatement;
		first<T = unknown>(colName?: string): Promise<T | null>;
		run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
		all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
		raw<T = unknown[]>(): Promise<T[]>;
	}
	interface D1Result<T = Record<string, unknown>> {
		results?: T[];
		success: boolean;
		error?: string;
		meta: Record<string, unknown>;
	}
	interface D1ExecResult {
		count: number;
		duration: number;
	}

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
