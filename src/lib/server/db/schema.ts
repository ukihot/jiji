import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * イベントログ（design.md 5章）。追記専用。
 * UPDATE/DELETEはdb/bootstrap.tsのSQLiteトリガーでアプリ外から拒否する。
 * リポジトリ層（shell/repository/event-repository.ts）もinsertしか公開しない。
 */
export const event = sqliteTable('event', {
	id: text('id').primaryKey(),
	targetType: text('target_type').notNull(),
	targetId: text('target_id').notNull(),
	type: text('type').notNull(),
	payload: text('payload', { mode: 'json' }).notNull(),
	prevHash: text('prev_hash'),
	hash: text('hash').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
});

/**
 * 作品。design.mdのtimeline/asset物理設計がtitle_idを参照しているが
 * title自体の物理設計表への記載が抜けていたため、ここで補って定義する。
 */
export const title = sqliteTable('title', {
	id: text('id').primaryKey(),
	name: text('name').notNull()
});

// design.md 4章: timeline | id, title_id, season, episode
export const timeline = sqliteTable('timeline', {
	id: text('id').primaryKey(),
	titleId: text('title_id')
		.notNull()
		.references(() => title.id),
	season: text('season').notNull(),
	episode: integer('episode').notNull()
});

/**
 * design.md 4章/4.0.1節: timeline_item | id, timeline_id, type, label(text), sort_order(int), width_frames(int)
 * Timeline上に並ぶ要素の共通台帳。Cutだけでなく、将来のAudio/Transition/Markerもこの1テーブルに乗る。
 * MVPで実際にINSERTされるのは type = 'cut' の行のみ。
 */
export const timelineItem = sqliteTable('timeline_item', {
	id: text('id').primaryKey(),
	timelineId: text('timeline_id')
		.notNull()
		.references(() => timeline.id),
	type: text('type').$type<'cut' | 'audio' | 'transition' | 'marker'>().notNull(),
	label: text('label').notNull(),
	sortOrder: integer('sort_order').notNull(),
	widthFrames: integer('width_frames')
});

/**
 * design.md 4章/4.0.1節: cut | id(=timeline_item.id), scene_tags(json)
 * idは独自採番せずtimeline_item.idをそのままPK/FKとして共有する（クラステーブル継承）。
 * number・sort_order・尺はtimeline_item側に統合済みのため、Cut固有の属性のみを持つ。
 */
export const cut = sqliteTable('cut', {
	id: text('id')
		.primaryKey()
		.references(() => timelineItem.id),
	sceneTags: text('scene_tags', { mode: 'json' }).$type<string[]>().notNull()
});

/**
 * design.md 8章/8.5.2節: person | id, name, email(nullable), account_type(internal/external)
 * emailはMagic Identity経由のexternal（8.5節）ではNULLのままでよい。
 * SQLiteのUNIQUE制約はNULL同士を衝突させないため、複数のemail無しpersonが共存できる。
 */
export const person = sqliteTable('person', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').unique(),
	accountType: text('account_type').$type<'internal' | 'external'>().notNull()
});

/**
 * design.md 8章: membership。Googleスプレッドシートの共有を踏襲したアクセス権。
 * expires_at超過そのものはイベント化せず、Core `isActive(membership, now)` で都度導出する（8.2節）。
 */
export const membership = sqliteTable('membership', {
	id: text('id').primaryKey(),
	personId: text('person_id')
		.notNull()
		.references(() => person.id),
	scopeType: text('scope_type').$type<'title' | 'timeline'>().notNull(),
	scopeId: text('scope_id').notNull(),
	permissionLevel: text('permission_level')
		.$type<'viewer' | 'contributor' | 'reviewer' | 'admin'>()
		.notNull(),
	processScope: text('process_scope', { mode: 'json' }).$type<string[] | null>(),
	grantedBy: text('granted_by')
		.notNull()
		.references(() => person.id),
	grantedAt: integer('granted_at', { mode: 'timestamp_ms' }).notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
	revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
	revokedBy: text('revoked_by').references(() => person.id)
});

/**
 * design.md 8.5節: share_link。外部作業者向けの時限アクセス。
 * permission_level=contributorはMagic Identity（8.5.2節）により初回アクセス時に名前入力を必須化し、
 * 生成したpersonをclaimed_person_idに記録する。viewerは匿名のままでよい（8.5.3節）。
 */
export const shareLink = sqliteTable('share_link', {
	id: text('id').primaryKey(),
	tokenHash: text('token_hash').notNull().unique(),
	targetCutIds: text('target_cut_ids', { mode: 'json' }).$type<string[]>().notNull(),
	permissionLevel: text('permission_level').$type<'viewer' | 'contributor'>().notNull(),
	claimedPersonId: text('claimed_person_id').references(() => person.id),
	// 無期限を選べないようexpiresAtは常に必須（アプリ層でも最長90日を強制。design.md 4章）
	expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
	createdBy: text('created_by')
		.notNull()
		.references(() => person.id),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
	revokedAt: integer('revoked_at', { mode: 'timestamp_ms' })
});

// ---- 投影テーブル（design.md 4.1節）：eventが正本。ここはCoreのproject関数の出力キャッシュ ----

// design.md 4.1節: timeline_band_view | episode_id, timeline_item_id, item_type, offset_frames, width_frames, process_status(json)
// MVPではprocess_statusを扱うSubmission/Reviewが未実装のため、そこは今回省略する。
export const timelineBandView = sqliteTable('timeline_band_view', {
	timelineItemId: text('timeline_item_id').primaryKey(),
	timelineId: text('timeline_id').notNull(),
	itemType: text('item_type').$type<'cut' | 'audio' | 'transition' | 'marker'>().notNull(),
	sortOrder: integer('sort_order').notNull(),
	offsetFrames: integer('offset_frames').notNull(),
	widthFrames: integer('width_frames').notNull()
});

// design.md 4.1節/8.2節: membership_state
export const membershipState = sqliteTable('membership_state', {
	membershipId: text('membership_id').primaryKey(),
	personId: text('person_id').notNull(),
	scopeType: text('scope_type').$type<'title' | 'timeline'>().notNull(),
	scopeId: text('scope_id').notNull(),
	permissionLevel: text('permission_level')
		.$type<'viewer' | 'contributor' | 'reviewer' | 'admin'>()
		.notNull(),
	processScope: text('process_scope', { mode: 'json' }).$type<string[] | null>(),
	grantedAt: integer('granted_at', { mode: 'timestamp_ms' }).notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
	revokedAt: integer('revoked_at', { mode: 'timestamp_ms' })
});
