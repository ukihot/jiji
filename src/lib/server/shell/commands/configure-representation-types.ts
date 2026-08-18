import {
	decideRepresentationTypesConfig,
	type RepresentationType,
	type RepresentationTypesConfigError,
} from '$lib/core/representation';
import type { SqliteDb } from '../../db';
import { appendEvent } from '../repository/event-repository';
import { replaceEnabledRepresentationTypes } from '../repository/production-repository';

export interface ConfigureRepresentationTypesInput {
	titleId: string;
	enabledTypes: RepresentationType[];
	configuredBy: string;
}

export type ConfigureRepresentationTypesResult =
	| { ok: true }
	| { ok: false; error: RepresentationTypesConfigError };

/**
 * design.md 4.0.2節改訂: プロジェクト設定画面から、このTitleで使うRepresentation種別を
 * チェックボックスで選び直す。'title'ストリームとは別の'title-representation-config'ストリームに
 * 乗せる（representation.tsファイル末尾のコメント参照）。
 */
export async function configureRepresentationTypes(
	db: SqliteDb,
	input: ConfigureRepresentationTypesInput,
): Promise<ConfigureRepresentationTypesResult> {
	const now = new Date();
	return db.transaction(async (tx): Promise<ConfigureRepresentationTypesResult> => {
		const decision = decideRepresentationTypesConfig(
			{
				type: 'ConfigureRepresentationTypes',
				titleId: input.titleId,
				enabledTypes: input.enabledTypes,
				configuredBy: input.configuredBy,
			},
			{ now },
		);
		if (!decision.ok) return { ok: false, error: decision.error };

		await appendEvent(tx, 'title-representation-config', input.titleId, decision.events[0], now);
		await replaceEnabledRepresentationTypes(tx, input.titleId, input.enabledTypes);

		return { ok: true };
	});
}
