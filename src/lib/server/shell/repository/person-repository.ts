import { asc, eq } from 'drizzle-orm';
import type { SqliteQueryable } from '../../db';
import { person } from '../../db/schema';

export interface PersonRow {
	id: string;
	name: string;
	/** design.md 8.5.2節: Magic Identity経由のexternalはメール無しで作成される */
	email: string | null;
	accountType: 'internal' | 'external';
}

export async function getPerson(db: SqliteQueryable, personId: string): Promise<PersonRow | null> {
	const rows = await db.select().from(person).where(eq(person.id, personId));
	return rows[0] ?? null;
}

export async function listPersons(db: SqliteQueryable): Promise<PersonRow[]> {
	return db.select().from(person).orderBy(asc(person.name));
}

/** design.md 8.4節の開発用スタブログインで選べる相手（内部ユーザーのみ） */
export async function listInternalPersons(db: SqliteQueryable): Promise<PersonRow[]> {
	return db.select().from(person).where(eq(person.accountType, 'internal')).orderBy(asc(person.name));
}

export async function insertPerson(db: SqliteQueryable, row: PersonRow): Promise<void> {
	await db.insert(person).values(row);
}
