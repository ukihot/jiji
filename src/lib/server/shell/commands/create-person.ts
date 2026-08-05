import type { SqliteDb } from '../../db';
import { insertPerson } from '../repository/person-repository';

/**
 * Personの登録自体はdesign.mdの業務ルール（decide）を持たないため、Core層は経由しない。
 * internalアカウントは将来のID/PW+TOTP用にemailを必須とするが、
 * externalはMagic Identity（8.5.2節）経由でemail無しのPersonが作られることもあるため、
 * この管理画面からの手動登録でもemailを任意にしておく。
 */
export interface CreatePersonInput {
	name: string;
	email: string | null;
	accountType: 'internal' | 'external';
}

export type CreatePersonResult =
	| { ok: true; personId: string }
	| { ok: false; error: { kind: 'blank_name' } | { kind: 'email_required_for_internal' } };

export async function createPerson(
	db: SqliteDb,
	input: CreatePersonInput,
): Promise<CreatePersonResult> {
	if (input.name.trim().length === 0) return { ok: false, error: { kind: 'blank_name' } };
	if (input.accountType === 'internal' && (!input.email || input.email.trim().length === 0)) {
		return { ok: false, error: { kind: 'email_required_for_internal' } };
	}

	const personId = crypto.randomUUID();
	await insertPerson(db, {
		id: personId,
		name: input.name,
		email: input.email,
		accountType: input.accountType,
	});
	return { ok: true, personId };
}
