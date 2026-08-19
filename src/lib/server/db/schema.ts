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
	/** internalのみ。nullは共有URLから来た参加者 */
	workspaceRole: text('workspace_role').$type<'owner' | 'admin' | 'member'>(),
	/** Relay画面で社内共有フォルダへの書込みを開始できる明示権限。ownerが設定する。 */
	relayEnabled: integer('relay_enabled', { mode: 'boolean' }).notNull().default(false),
});

/**
 * Relayのファイル本体はJiji管理ストレージではなく、Titleの運営者が指定した
 * Object Storageに保存する。authRefは秘密そのものではなくホスト側secret storeの参照名。
 */
export const relayStorageConnection = sqliteTable('relay_storage_connection', {
	id: text('id').primaryKey(),
	titleId: text('title_id')
		.notNull()
		.references(() => title.id),
	provider: text('provider')
		.$type<'s3' | 's3_compatible' | 'supabase' | 'gcs' | 'azure_blob'>()
		.notNull(),
	endpoint: text('endpoint'),
	region: text('region'),
	bucketOrContainer: text('bucket_or_container').notNull(),
	prefix: text('prefix').notNull(),
	authRef: text('auth_ref').notNull(),
	/**
	 * 実際の署名鍵。design.mdは外部secret storeへの参照だけを持つ想定だったが、
	 * セルフホストで組織ごとに異なる鍵を運用管理者が都度払い出す運用に合わせ、
	 * このテーブルに直接保持する（10章の未決定事項）。ブラウザへは絶対に返さない
	 * （PublicRelayStorageConnectionRowで除外する）。
	 */
	accessKeyId: text('access_key_id'),
	secretAccessKey: text('secret_access_key'),
	enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
	createdBy: text('created_by')
		.notNull()
		.references(() => person.id),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

/** Directory Handleは絶対にここへ保存しない。これは端末ブラウザのRelay可用性だけを持つ。 */
export const relayRegistration = sqliteTable('relay_registration', {
	id: text('id').primaryKey(),
	titleId: text('title_id')
		.notNull()
		.references(() => title.id),
	storageConnectionId: text('storage_connection_id')
		.notNull()
		.references(() => relayStorageConnection.id),
	browserInstanceId: text('browser_instance_id').notNull(),
	displayName: text('display_name').notNull(),
	registeredBy: text('registered_by')
		.notNull()
		.references(() => person.id),
	allowedRootKey: text('allowed_root_key').notNull(),
	writable: integer('writable', { mode: 'boolean' }).notNull().default(false),
	lastHeartbeatAt: integer('last_heartbeat_at', { mode: 'timestamp_ms' }),
	lastErrorCode: text('last_error_code'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

/** 出稿機能がRelayへ配送するための永続キュー。object keyは利用者入力ではなくサーバーが採番する。 */
export const relayTransferJob = sqliteTable('relay_transfer_job', {
	id: text('id').primaryKey(),
	titleId: text('title_id')
		.notNull()
		.references(() => title.id),
	storageConnectionId: text('storage_connection_id')
		.notNull()
		.references(() => relayStorageConnection.id),
	sourceObjectKey: text('source_object_key').notNull(),
	targetRelativePath: text('target_relative_path').notNull(),
	expectedSize: integer('expected_size').notNull(),
	/**
	 * 出稿元でsha256を計算済みの場合だけ埋まる。バケット直置きファイルをlist scanで
	 * 発見しただけのjob（相手先アップロード時にJijiが計算していない）はnullのまま、
	 * サイズ一致のみで検証する（completeRelayTransferDelivery参照）。
	 */
	expectedSha256: text('expected_sha256'),
	state: text('state').$type<'pending' | 'leased' | 'delivered' | 'failed'>().notNull(),
	/** Relayが社内共有フォルダへ確定後に再読込して照合した配送結果。 */
	deliveredSize: integer('delivered_size'),
	deliveredSha256: text('delivered_sha256'),
	sharedFolderVerifiedAt: integer('shared_folder_verified_at', { mode: 'timestamp_ms' }),
	/** object storageからの削除も終わるまで、出稿全体を完了として表示しない。 */
	sourceDeleteState: text('source_delete_state')
		.$type<'not_ready' | 'pending' | 'deleting' | 'deleted' | 'retryable_error'>()
		.notNull()
		.default('not_ready'),
	sourceDeletedAt: integer('source_deleted_at', { mode: 'timestamp_ms' }),
	sourceDeleteRetryCount: integer('source_delete_retry_count').notNull().default(0),
	sourceDeleteLastErrorCode: text('source_delete_last_error_code'),
	retryCount: integer('retry_count').notNull().default(0),
	leaseUntil: integer('lease_until', { mode: 'timestamp_ms' }),
	leasedRelayId: text('leased_relay_id').references(() => relayRegistration.id),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

/** 個々の配送試行は上書きせず、監査可能な記録として追記する。 */
export const relayTransferAttempt = sqliteTable('relay_transfer_attempt', {
	id: text('id').primaryKey(),
	jobId: text('job_id')
		.notNull()
		.references(() => relayTransferJob.id),
	relayId: text('relay_id')
		.notNull()
		.references(() => relayRegistration.id),
	leaseToken: text('lease_token').notNull(),
	result: text('result')
		.$type<'started' | 'delivered' | 'retryable_error' | 'terminal_error'>()
		.notNull(),
	actualSize: integer('actual_size'),
	actualSha256: text('actual_sha256'),
	errorCode: text('error_code'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

/**
 * 制作対象への担当割当。独立した「タスク」ではなく、作品・話数・カット・工程という
 * 実体に対する責務を表す投影。現在の担当者はこの表、変更履歴はeventに保存する。
 */
export const workAssignment = sqliteTable('work_assignment', {
	id: text('id').primaryKey(),
	targetType: text('target_type')
		.$type<'title' | 'timeline' | 'cut' | 'representation' | 'process_node'>()
		.notNull(),
	targetId: text('target_id').notNull(),
	assigneeId: text('assignee_id')
		.notNull()
		.references(() => person.id),
	assignedAt: integer('assigned_at', { mode: 'timestamp_ms' }).notNull(),
});

/**
 * Production Kernel（design.md 11章）。公開済みBlueprintは不変で、編集は常に次versionの
 * 下書きとして行う。過去のカットがどの工程定義に従ったかを再生できるようにする。
 */
export const productionBlueprint = sqliteTable('production_blueprint', {
	id: text('id').primaryKey(),
	titleId: text('title_id')
		.notNull()
		.references(() => title.id),
	version: integer('version').notNull(),
	status: text('status').$type<'draft' | 'published' | 'retired'>().notNull(),
	basedOnBlueprintId: text('based_on_blueprint_id'),
	publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const processNode = sqliteTable('process_node', {
	id: text('id').primaryKey(),
	blueprintId: text('blueprint_id')
		.notNull()
		.references(() => productionBlueprint.id),
	capabilityKey: text('capability_key').notNull(),
	representationType: text('representation_type').$type<
		| 'storyboard'
		| 'animatic'
		| 'layout'
		| 'animation'
		| 'bg'
		| 'cg_render'
		| 'composite'
		| 'final'
		| null
	>(),
	kind: text('kind').$type<'deliverable' | 'review' | 'milestone'>().notNull(),
	required: integer('required', { mode: 'boolean' }).notNull(),
	sortHint: integer('sort_hint').notNull(),
});

export const processEdge = sqliteTable('process_edge', {
	id: text('id').primaryKey(),
	blueprintId: text('blueprint_id')
		.notNull()
		.references(() => productionBlueprint.id),
	fromNodeId: text('from_node_id')
		.notNull()
		.references(() => processNode.id),
	toNodeId: text('to_node_id')
		.notNull()
		.references(() => processNode.id),
	relation: text('relation').$type<'requires' | 'feeds' | 'informs'>().notNull(),
});

/** 作品内の表示名と安定したCapabilityを分離する。過去の語彙もイベントから再現できる。 */
export const studioTerm = sqliteTable('studio_term', {
	id: text('id').primaryKey(),
	titleId: text('title_id')
		.notNull()
		.references(() => title.id),
	capabilityKey: text('capability_key').notNull(),
	displayName: text('display_name').notNull(),
	aliases: text('aliases', { mode: 'json' }).$type<string[]>().notNull(),
	usageNote: text('usage_note'),
	activeFromEventId: text('active_from_event_id').notNull(),
	retiredAt: integer('retired_at', { mode: 'timestamp_ms' }),
});

/** ゲートは工程nodeの定義、通過した事実はgate_evidenceに分ける。 */
export const reviewGate = sqliteTable('review_gate', {
	id: text('id').primaryKey(),
	processNodeId: text('process_node_id')
		.notNull()
		.references(() => processNode.id),
	gateKey: text('gate_key').notNull(),
	reviewerPolicy: text('reviewer_policy', { mode: 'json' }).$type<string[]>().notNull(),
	required: integer('required', { mode: 'boolean' }).notNull(),
});

export const gateEvidence = sqliteTable('gate_evidence', {
	id: text('id').primaryKey(),
	gateId: text('gate_id')
		.notNull()
		.references(() => reviewGate.id),
	versionId: text('version_id')
		.notNull()
		.references(() => version.id),
	versionHash: text('version_hash').notNull(),
	reviewerId: text('reviewer_id')
		.notNull()
		.references(() => person.id),
	result: text('result').$type<'passed' | 'returned'>().notNull(),
	recordedAt: integer('recorded_at', { mode: 'timestamp_ms' }).notNull(),
});

/** 前工程の創作判断を、根拠版と対象範囲に結び付ける。 */
export const decisionCapsule = sqliteTable('decision_capsule', {
	id: text('id').primaryKey(),
	titleId: text('title_id')
		.notNull()
		.references(() => title.id),
	scopeType: text('scope_type').$type<'title' | 'timeline' | 'cut'>().notNull(),
	scopeId: text('scope_id').notNull(),
	decisionKey: text('decision_key').notNull(),
	decisionText: text('decision_text').notNull(),
	status: text('status').$type<'open' | 'confirmed' | 'superseded'>().notNull(),
	confirmedBy: text('confirmed_by').references(() => person.id),
	confirmedAt: integer('confirmed_at', { mode: 'timestamp_ms' }),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const decisionEvidence = sqliteTable('decision_evidence', {
	id: text('id').primaryKey(),
	capsuleId: text('capsule_id')
		.notNull()
		.references(() => decisionCapsule.id),
	versionId: text('version_id')
		.notNull()
		.references(() => version.id),
	coverage: text('coverage', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
	role: text('role').$type<'reference' | 'approval' | 'test'>().notNull(),
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
