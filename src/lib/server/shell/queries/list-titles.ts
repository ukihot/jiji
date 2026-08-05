import type { SqliteDb } from '../../db';
import { listTitles as listTitleRows, type TitleRow } from '../repository/timeline-repository';

export function listTitles(db: SqliteDb): Promise<TitleRow[]> {
	return listTitleRows(db);
}
