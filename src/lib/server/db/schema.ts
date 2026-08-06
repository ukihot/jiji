import {
	type AnySQLiteColumn,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from 'drizzle-orm/sqlite-core';

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
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

/**
 * 作品。design.mdのtimeline/asset物理設計がtitle_idを参照しているが
 * title自体の物理設計表への記載が抜けていたため、ここで補って定義する。
 */
export const title = sqliteTable('title', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
});

// design.md 4章: timeline | id, title_id, season, episode
export const timeline = sqliteTable('timeline', {
	id: text('id').primaryKey(),
	titleId: text('title_id')
		.notNull()
		.references(() => title.id),
	season: text('season').notNull(),
	episode: integer('episode').notNull(),
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
	widthFrames: integer('width_frames'),
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
	sceneTags: text('scene_tags', { mode: 'json' }).$type<string[]>().notNull(),
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
	accountType: text('account_type').$type<'internal' | 'external'>().notNull(),
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
	revokedBy: text('revoked_by').references(() => person.id),
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
	revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
});

/**
 * design.md 4.0.2節: representation | id, cut_id, type(固定enum), sort_order
 * Cutが工程を経て取る表現形態。type は8種の固定enumで、7章の工程DAGと同様にユーザー拡張は許可しない。
 * 1 Cutにつき同じtypeは1件のみ（アプリ層で保証。SQLiteはUNIQUE(cut_id, type)を実際には未付与——
 * db:push/db:studioが使えない制約下でのMVPでは複合UNIQUEの追加を見送り、decide側の重複防止に委ねる）。
 */
export const representation = sqliteTable('representation', {
	id: text('id').primaryKey(),
	cutId: text('cut_id')
		.notNull()
		.references(() => cut.id),
	type: text('type')
		.$type<
			| 'storyboard'
			| 'animatic'
			| 'layout'
			| 'animation'
			| 'bg'
			| 'cg_render'
			| 'composite'
			| 'final'
		>()
		.notNull(),
	sortOrder: integer('sort_order').notNull(),
});

/**
 * design.md 4章: submission | id, cut_id, representation_id, process_step, submitted_by, submitted_at
 * MVP（Asset未実装）では常にCutへの提出のみを扱うため、cut_id/representation_idは両方notNullとする。
 * Asset/CutAsset実装時にrepresentation_idをnullable化し、asset_idを追加する（design.md 9章の型）。
 */
export const submission = sqliteTable('submission', {
	id: text('id').primaryKey(),
	cutId: text('cut_id')
		.notNull()
		.references(() => cut.id),
	representationId: text('representation_id')
		.notNull()
		.references(() => representation.id),
	processStep: text('process_step').notNull(),
	submittedBy: text('submitted_by')
		.notNull()
		.references(() => person.id),
	submittedAt: integer('submitted_at', { mode: 'timestamp_ms' }).notNull(),
});

/**
 * design.md 4章/4.0.2節: version | id, submission_id, seq, file_ref, proxy_ref, artifact_metadata(json), created_at
 * 追記専用（UPDATE/DELETE禁止）。eventと同じ理由でdb/bootstrap.tsにトリガーを持つ。
 * artifact_metadataはEXR AOV/PSDレイヤー/PNGアルファ有無等、成果物形式ごとの内部構造メタデータのみを持つ
 * （F-25）。プロキシは今回未実装のためproxy_refは常にnullのまま（ffmpegパイプラインは範囲外）。
 * derived_from_version_id/relationは「このVersionがどのVersionから派生したか」という制作上の因果関係
 * （別Representationの版から作られることが普通にある。例: Layout v5から作画してAnimation v1ができる）。
 * 自己参照FKだが、UPDATE禁止のためこの列を後から差し替えることはできない（提出時に確定する）。
 */
export const version = sqliteTable('version', {
	id: text('id').primaryKey(),
	submissionId: text('submission_id')
		.notNull()
		.references(() => submission.id),
	seq: integer('seq').notNull(),
	fileRef: text('file_ref').notNull(),
	proxyRef: text('proxy_ref'),
	artifactMetadata: text('artifact_metadata', { mode: 'json' }).$type<Record<
		string,
		unknown
	> | null>(),
	derivedFromVersionId: text('derived_from_version_id').references(
		(): AnySQLiteColumn => version.id,
	),
	derivedFromRelation: text('derived_from_relation').$type<
		'refined' | 'converted' | 'replaced' | null
	>(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

// design.md 4章: review | id, version_id, reviewer_id, result, comment, reviewed_at
export const review = sqliteTable('review', {
	id: text('id').primaryKey(),
	versionId: text('version_id')
		.notNull()
		.references(() => version.id),
	reviewerId: text('reviewer_id')
		.notNull()
		.references(() => person.id),
	result: text('result').$type<'approved' | 'returned'>().notNull(),
	comment: text('comment'),
	reviewedAt: integer('reviewed_at', { mode: 'timestamp_ms' }).notNull(),
});

/**
 * design.md 4章/6.2節: seal | id, version_id, hash, sealed_by, sealed_at
 * 「その版を採用した」という事実の記録。Reviewとは明確に別（representation.tsファイル冒頭コメント参照）。
 * 追記専用（version/eventと同じ理由。db/bootstrap.tsにトリガーを持つ）。
 * hashはversionの内容（file_ref/artifact_metadata/derived_from等）をcanonicalJson+SHA-256したもの
 * （lib/core/event-hash.tsのcomputeEventHashを流用）。封印後の再計算差分で改竄を検知する。
 */
export const seal = sqliteTable('seal', {
	id: text('id').primaryKey(),
	versionId: text('version_id')
		.notNull()
		.references(() => version.id),
	hash: text('hash').notNull(),
	sealedBy: text('sealed_by')
		.notNull()
		.references(() => person.id),
	sealedAt: integer('sealed_at', { mode: 'timestamp_ms' }).notNull(),
});

// ---- 投影テーブル（design.md 4.1節）：eventが正本。ここはCoreのproject関数の出力キャッシュ ----

/**
 * design.md 4.1節: timeline_band_view | episode_id, timeline_item_id, item_type, offset_frames, width_frames, process_status(json)
 * process_statusはRepresentation種別をキーにしたマップ。cut以外の行では常にnull。
 */
export const timelineBandView = sqliteTable('timeline_band_view', {
	timelineItemId: text('timeline_item_id').primaryKey(),
	timelineId: text('timeline_id').notNull(),
	itemType: text('item_type').$type<'cut' | 'audio' | 'transition' | 'marker'>().notNull(),
	sortOrder: integer('sort_order').notNull(),
	offsetFrames: integer('offset_frames').notNull(),
	widthFrames: integer('width_frames').notNull(),
	processStatus: text('process_status', { mode: 'json' }).$type<Record<
		string,
		{ latestVersionId: string; approvedVersionId: string | null }
	> | null>(),
});

/**
 * design.md 4.1節: representation_current_version | representation_id, latest_version_id, approved_version_id
 * 「最新版」「採用版」はRepresentation単位（要件定義6.2節）。approved_version_idはSeal実装時（design.md 6.3節）まで常にnull。
 */
export const representationCurrentVersion = sqliteTable('representation_current_version', {
	representationId: text('representation_id').primaryKey(),
	latestVersionId: text('latest_version_id').notNull(),
	approvedVersionId: text('approved_version_id'),
});

/**
 * design.md 4.0.2節改訂: title_representation_type | title_id, type
 * そのTitle（プロジェクト）で有効なRepresentation種別の投影（存在＝有効）。行が1つも無いTitleは
 * 「まだ設定していない」＝全種類が有効という既定として扱う（Core側 applyRepresentationTypesDefault参照）。
 * 正本は'title-representation-config'+titleIdストリームのRepresentationTypesConfiguredイベント。
 */
export const titleRepresentationType = sqliteTable(
	'title_representation_type',
	{
		titleId: text('title_id')
			.notNull()
			.references(() => title.id),
		type: text('type')
			.$type<
				| 'storyboard'
				| 'animatic'
				| 'layout'
				| 'animation'
				| 'bg'
				| 'cg_render'
				| 'composite'
				| 'final'
			>()
			.notNull(),
	},
	(t) => [primaryKey({ columns: [t.titleId, t.type] })],
);

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
	revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
});
