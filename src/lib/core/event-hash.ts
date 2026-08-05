import { createHash } from 'node:crypto';

/**
 * design.md 5章: ハッシュチェーンの入力になる最小限のイベント情報。
 */
export interface EventForHash {
	type: string;
	payload: unknown;
	createdAt: Date;
}

/**
 * オブジェクトのキーをソートして決定的なJSON文字列を作る。
 * 同じ内容のオブジェクトはキー順に関わらず常に同じ文字列になる。
 */
export function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== 'object') {
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
	}
	const record = value as Record<string, unknown>;
	const keys = Object.keys(record).sort();
	const entries = keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
	return `{${entries.join(',')}}`;
}

/**
 * design.md 5章:
 * event[n].hash = SHA-256( event[n-1].hash + canonical_json(event[n].payload, event[n].created_at, event[n].type) )
 *
 * 純粋関数。DB・時刻取得を行わない（createdAtは引数として渡されたものをそのまま使う）。
 */
export function computeEventHash(prevHash: string | null, event: EventForHash): string {
	const material = canonicalJson({
		type: event.type,
		payload: event.payload,
		createdAt: event.createdAt.toISOString()
	});
	return createHash('sha256')
		.update((prevHash ?? '') + material)
		.digest('hex');
}
