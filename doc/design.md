# 作品管理ツール「Jiji」設計書 v0.3

**対応要件定義: doc/requirements.md v0.3**

---

# 0. この文書の位置づけ

要件定義（doc/requirements.md）は「何を実現するか」を定める。「どう実装するか」は本書に置く。技術選定とUIワイヤーフレームは設計内容として本書に置き、要件定義側には制約（要件レベル）のみを残す。

バックエンドはSvelteKit（TypeScript）で実装する。フロントエンドと同一プロセス・同一デプロイ単位とし、別言語・別プロセスのAPIサーバは持たない。DB層はDrizzle ORMで抽象化し、セルフホスト時はSQLite、ホスティングSaaS版はCloudflare D1を対象とする。

---

# 1. 全体アーキテクチャ

```text
                         ┌───────────────────────────┐
                         │         Browser           │
                         │  Svelte 5 Components       │
                         │  Timeline / Player / etc.  │
                         └──────────────┬─────────────┘
                                        │ HTTP / fetch
                         ┌──────────────▼─────────────┐
                         │        SvelteKit            │
                         │  (Bun runtime)               │
                         │                              │
                         │  routes/**/+page.server.ts   │  ← 画面ごとのデータ取得
                         │  routes/**/+server.ts        │  ← API / Webhook的な口
                         │  lib/core/**                 │  ← Functional Core（純粋関数）
                         │  lib/server/shell/**         │  ← Imperative Shell（コマンド/クエリ）
                         │  lib/server/db/**            │  ← Drizzle（event表＋投影テーブル）
                         │  lib/server/media/**         │  ← ffmpeg起動・プロキシ管理
                         └───────┬───────────┬──────────┘
                                 │           │
                     ┌───────────▼───┐   ┌───▼─────────────────┐
                     │ SQLite / D1    │   │ 既存ストレージ         │
                     │ (Drizzle経由)  │   │ NAS / S3互換 / Local  │
                     │ メタデータ      │   │ 原本ファイル（寄生先） │
                     │ イベントログ    │   └──────────────────────┘
                     │ プロキシ参照    │
                     └────────────────┘
```

Jijiは単一のSvelteKitアプリケーションであり、フロントエンドとバックエンドを分離しない。「バックエンド」はSvelteKitのサーバーサイド（`+page.server.ts` / `+server.ts` / `lib/server/**`）として実装する。

## 1.1 配布形態は2パターン

| モード | 用途 | DB | 実行方法 |
|---|---|---|---|
| **セルフホスト（既定）** | エアギャップ環境、スタジオのローカルマシン | SQLite（ファイル1個） | `bun build --compile` で単一実行ファイル化。ffmpegはサブプロセスとして同居 |
| **ホスティングSaaS（将来・任意）** | 要件書10.1/ライセンス節にある有償ホスティング案 | Cloudflare D1 | SvelteKit adapter-cloudflare。Workers上で実行 |

DrizzleでSQLite/D1を抽象化しているのは、この2モードをスキーマ・クエリコード無変更で両立させるため。

## 1.2 なぜ独立したAPIサーバを持たないか

前提の確認：ブラウザ側のJSは一切DBに触れない。DBアクセスを行うのは`lib/server/**`（SvelteKitのサーバー専用モジュール）のみで、これはビルド時にクライアントバンドルへの混入がSvelteKit自身によって禁止される。

「バックエンドが無い」のではなく、**バックエンド（サーバー実行コンテキスト）とフロントエンドが同じデプロイ単位・同じプロセスに同居している**だけである。正確には「独立したAPIサーバ層を持たないフルスタック構成」であり、Next.js/Remix/Nuxtも同じモデルを取る。目新しい選択ではない。

### 採用理由

| 観点 | 理由 |
|---|---|
| エアギャップ要件（N-01/N-02） | プロセスが1つなので「外部通信ゼロ」の監査対象が単純になる。フロント⇄API間のネットワーク境界が存在しないため、そこを流れる通信自体を心配する必要がない |
| シングルバイナリ配布（N-13/N-14） | `bun build --compile`で固める対象が1プロセスで済む。APIサーバとフロントを別々にビルド・同梱・プロセス管理する必要がない |
| 監査ログの整合性 | Jijiの核心（P-03/P-04: イベントは追記専用ですべて記録される）を支えるには、DBへの書き込み経路がShellのコマンドハンドラ1箇所に絞られている方が、抜け道が構造的に作りにくい。サービスを分割すると書き込み経路が増え、イベント化されない変更が紛れ込むリスクが上がる |
| 型の一気通貫 | Drizzleのスキーマ型がserver loadの返り値型、Svelteコンポーネントのpropsまで繋がる。API契約（DTO / OpenAPI）を別途手で維持するコストが要らない |

### この構成でも崩さない点（注意）

* **層の分離は引き続き必要**：「APIサーバが無い」ことと「ドメインロジックをルートハンドラに直書きしていい」ことは別の話。3章のとおりFunctional Core / Imperative Shellで層を分ける規律を維持する
* **将来の外部連携**（F-51タイムシート連携、F-52 AE連携、F-53 DCC連携）には安定した公開API契約が要る。`+server.ts`を公開エンドポイントとして使えば実現自体は詰まないが、セッションCookie前提の内部向けエンドポイントと、トークン認証の外部向けエンドポイントは意図的に分けて設計する必要がある
* **メディア処理のスケール**：ffmpegの負荷が増した場合は6章のとおりバックグラウンドジョブとして切り離す。これは「APIサーバを分けるか」とは独立した論点であり、一体型アーキテクチャを選んだこと自体の障害にはならない

## 1.3 デプロイ先はCloudflare Workers（Pagesではない）

SvelteKit用のアダプターは`@sveltejs/adapter-cloudflare`のみで、これ1つが「Cloudflare Workers Static Assets」「Cloudflare Pages」の両方に出力できる（Pages専用の別パッケージは無い。旧`adapter-cloudflare-workers`はWorkers Sites時代のものでdeprecated）。D1バインディングへのアクセス方法はどちらの出力先でも同じ（`platform.env`経由）。

Cloudflare公式のSvelteKitフレームワークガイドはworkers/framework-guides配下にあり、Workersへのデプロイとして案内されている。新規のフルスタックプロジェクトは「Workers + Static Assets」でフロントエンドとバックエンドを1つのデプロイ単位にまとめる構成が案内されており、新機能もWorkers側に優先して追加される。

**Jijiのデプロイ先はWorkersとする。** 1.2節の「独立したAPIサーバを持たない一体型構成」と、Workers + Static Assetsの設計思想（1つのWorkerがフロント配信とAPI処理の両方を担う）が一致するため。

参考:

* https://developers.cloudflare.com/workers/framework-guides/web-apps/sveltekit/
* https://svelte.dev/docs/kit/adapter-cloudflare

---

# 2. アーキテクチャパターン: Functional Core / Imperative Shell + CQRS

ドメインロジックはFunctional Core / Imperative Shell（FCIS）で構成し、書き込み（コマンド）と読み取り（クエリ）の経路を分離する（CQRS）。

Jijiの状態はもともとイベント履歴から導出される設計（要件定義P-03「工程は状態ではなく履歴である」）であり、タイムトラベル・監査証跡パックもイベント列の再生を前提にしている。これはイベントソーシングそのものであり、FCIS + CQRSは既存の要件をコードの構造として素直に表したものになる。

## 2.1 CoreとShellの境界

| 区分 | 定義 | 含むもの |
|---|---|---|
| **Core**（`lib/core/**`） | 純粋関数のみ。DB・現在時刻・乱数・ネットワーク・ffmpegを一切呼ばない。同じ入力からは常に同じ出力になる | 意思決定関数（decide）、状態畳み込み関数（evolve）、投影関数（project）、ハッシュチェーン計算 |
| **Shell**（`lib/server/shell/**`） | すべての副作用を担う | コマンドハンドラ、クエリハンドラ、リポジトリ（Drizzle）、メディア処理、認証 |

判定基準：**現在時刻・乱数・DB・ネットワークに一切触れずにVitestで即テストできる関数はCore、そうでなければShell。** 時刻やIDが要る場合はCoreの引数として渡し、生成自体はShellが行う。

## 2.2 コマンド側（書き込み）

```text
routes/**/+page.server.ts (action)
   ↓
Shell: コマンドハンドラ
   ├─ Shell: リポジトリからイベント列を取得
   ├─ Core: evolve(events) → 現在状態
   ├─ Core: decide(状態, コマンド) → Event[] | DomainError
   └─ Shell: 同一トランザクションでevent追記＋投影テーブル更新
```

業務ルールはすべて`decide`に閉じ込める。例：Issueの閉栓権チェックと理由必須、Versionの自動採番と上書き禁止、Seal可否判定、ShareLinkの有効期限（既定7日・最長90日）バリデーション。

## 2.3 クエリ側（読み取り・CQRS投影）

読み取り専用の投影テーブルを持ち、イベント追記と同一トランザクションでCoreの`project`関数を通して更新する。画面表示のたびにイベント全件を畳み込む必要がなくなる（性能要件N-17: 300カットを1秒以内、に対応）。

```text
event追記
   ↓（同一トランザクション）
Core: project(event, 現在の投影) → 新しい投影
   ↓
Shell: 投影テーブルをUPDATE
```

通常のCQRS/イベントソーシングは書き込みモデルと読み取りモデルが別ストアに分かれ、非同期反映による結果整合性が課題になる。Jijiは単一プロセス・単一DBであるため、投影更新を書き込みと同一トランザクションに含めることができ、この複雑さを持ち込まずに済む。

投影テーブルはCoreの出力をキャッシュしたものであり、正本は常に`event`テーブルである。タイムトラベル（要件定義5.3節）と監査証跡パック出力（F-36）は、投影テーブルを経由せずイベント列を直接`evolve`/`project`に通すことで任意時点の状態を再構成する。

---

# 3. レイヤー構成

```text
src/
  routes/                        … Presentation層（Svelte 5）
  lib/
    components/                   … 再利用可能なUIコンポーネント
    core/                         … Functional Core（純粋関数のみ）
      timeline-item.ts             … evolve / decide（配置・並べ替え・種別横断のoffset計算。4.0.1節）
      cut.ts                       … evolve / decide（Cut固有：シーン分類等）
      representation.ts            … evolve / decide（Representation作成・Submission受付。4.0.2節）
      version.ts
      seal.ts
      issue.ts                     … 閉栓権チェック・理由必須のdecide
      membership.ts                … evolve / decide（付与・変更・失効）＋ isActive(membership, now)
      share-link.ts                … 有効期限バリデーション＋Magic Identity招待の検証（8.5節）
      event-hash.ts                … ハッシュチェーン計算
      projections/
        issue-state.ts             … project: Issueの現在状態
        representation-current-version.ts … project: 最新版/合格版ポインタ（Representation単位。4.1節）
        timeline-band-view.ts      … project: 帯表示用ビューモデル
        membership-state.ts        … project: 現在のアクセス権一覧（失効判定はクエリ時にnowを渡して算出）
    server/
      shell/
        commands/                  … コマンドハンドラ（Core呼び出し＋永続化）
        queries/                   … クエリハンドラ（投影テーブル読み出し）
        repository/                … Drizzleクエリ
      db/
        schema.ts                  … Drizzleスキーマ（event表＋投影テーブル）
        index.ts                   … DB接続（SQLite/D1切替）
      media/
        proxy.ts                   … ffmpeg起動・プロキシ生成キュー
        storage-ref.ts             … NAS/S3互換/ローカル参照アダプタ
      auth/
        internal.ts                … ID/PW + TOTP。ログイン時だけでなくリクエスト毎にmembership有効性を再検証
        share-token.ts             … 署名付きURL発行・検証
```

原則：`routes/**`はShellのコマンドハンドラ／クエリハンドラを呼ぶだけでロジックを持たない。`lib/core/**`は他のどのディレクトリにも依存せず、DrizzleやBunのAPIを直接参照しない。

---

# 4. データモデル（物理設計）

要件定義6章のドメインモデルを物理テーブルに落とす。以下はテーブル設計の骨子（Drizzleスキーマの詳細な型は実装時に確定）。

| テーブル | 主なカラム | 設計上の注意 |
|---|---|---|
| `timeline` | id, title_id, season, episode | 話数単位で1レコード |
| `timeline_item` | id, timeline_id, type(cut/audio/transition/marker), label(text), sort_order(int), width_frames(int, markerは0/NULL可) | Timeline上に並ぶ要素の共通台帳。**Cutを含むすべての要素種別がこの1テーブルに乗る**（4.0.1節）。number/尺の表示順はここで一元管理する |
| `cut` | id(=timeline_item.id), scene_tags(json) | idは独自採番せず`timeline_item.id`をそのままPK/FKとして共有する（クラステーブル継承）。number・sort_order・尺は`timeline_item`側に統合済みのため、Cut固有の属性（シーン分類）のみを持つ |
| `representation` | id, cut_id, type(storyboard/animatic/layout/animation/bg/cg_render/composite/final), sort_order(int) | Cutが工程を経て取る表現形態（要件定義4.4節・6.1節）。1 Cutにつき同じtypeは1件（UNIQUE制約）。typeのカタログ自体は固定enumのまま（7章の工程DAGと同様、任意の名前をユーザーが自由追加できる項目にはしない）だが、このカタログのうちどれをそのTitleで使うかはプロジェクト単位で選べる（`title_representation_type`参照、4.0.2節改訂） |
| `title_representation_type` | title_id, type | そのTitleで有効なRepresentation種別の投影（存在＝有効。複合PK）。行が1つも無いTitleは「未設定」＝全種類有効という既定になる（4.0.2節改訂）。正本は`title-representation-config`+title_idストリームの`RepresentationTypesConfigured`イベント |
| `asset` | id, title_id, type, name | |
| `cut_asset` | cut_id, asset_id, used_version_id | 多対多の中間テーブル。使用版を記録。cut_idは`cut.id`（=`timeline_item.id`）を指すため、この節の変更による波及なし |
| `submission` | id, cut_id or asset_id, representation_id(nullable, FK→representation), process_step, submitted_by, submitted_at | representation_idはcut向け提出では必須、asset向け提出（7章のAsset DAG：モデリング/リグ/ルックデブ）ではNULL——AssetはRepresentationを持たない（4.0.2節） |
| `version` | id, submission_id, seq(int, 自動採番), file_ref, proxy_ref, artifact_metadata(json, nullable), derived_from_version_id(nullable, 自己参照FK), derived_from_relation(refined/converted/replaced, nullable), created_at | **UPDATE禁止・INSERTのみ**。上書きはアプリ層でも禁止する。artifact_metadataはEXR AOV/PSDレイヤー/PNGアルファ有無等、成果物形式ごとの内部構造を記録するのみで、プロキシ生成やRepresentation分割の対象にはしない（4.0.2節、F-25）。derived_from_*は「このVersionはどのVersionから作られたか」という制作上の因果関係（別Representationの版からのこともある。例: Layout v5からAnimation v1を作画）を残す |
| `review` | id, version_id, reviewer_id, result, comment, reviewed_at | |
| `seal` | id, version_id, hash, sealed_by, sealed_at | 対象バージョンのハッシュを記録。封印後の再計算差分で改竄検知 |
| `issue` | id, target_type, target_id, status(open/closed), closer_required_id, close_reason, opened_at, closed_at | 状態は2値のみ。open時にcloser必須、close時に理由必須（DB制約＋アプリ層バリデーションの二重化） |
| `event` | id, target_type, target_id, type, payload(json), prev_hash, hash, created_at | **追記専用**。DELETE/UPDATE不可（5章参照） |
| `share_link` | id, token_hash, target_cut_ids(json), permission_level(viewer/contributor), claimed_person_id(nullable, FK→person), expires_at(必須, NULL不可), created_by, revoked_at | 無期限を選べないようexpires_atをNOT NULLにし、アプリ層で最長90日を強制。`permission_level = contributor`は初回アクセス時にMagic Identity（8.5節）の名前入力を必須化し、生成した`person`を`claimed_person_id`に記録する |
| `person` | id, name, email(nullable), account_type(internal/external) | account_typeでログイン方式（internal: ID/PW+TOTP／external: 8.5節のMagic Identityによるtoken認証、または長期参加ならmembership付与）を分岐。emailはMagic Identity経由のexternalではNULLのままでよい |
| `membership` | id, person_id, scope_type(title/timeline), scope_id, permission_level(viewer/contributor/reviewer/admin), process_scope(json, NULL=全工程), granted_by, granted_at, expires_at, revoked_at, revoked_by | Googleスプレッドシートの共有を踏襲したアクセス権。expires_atはNULL可（恒常スタッフ）だが、単話参加・外部委託には運用上必須化する。閉栓権判定はpermission_level＋process_scopeで行う（8章） |

```text
Timeline ─< TimelineItem ─┬─ Cut ─┬─< CutAsset >─── Asset ─< Submission ─< Version
                           │       │                （Asset DAG：モデリング/リグ/ルックデブ。7章）
                           │       ├─< Representation ─< Submission ─< Version ─┬─< Review
                           │       │   （Storyboard/Layout/Animation/…。4.0.2節）  └─< Seal
                           │       └─< Issue ─< Event
                           ├─ Audio        （将来拡張）
                           ├─ Transition   （将来拡張）
                           └─ Marker       （将来拡張）
Timeline ─────────────────────────────────────────────< Event（timeline全体イベントも許容）
```

上図には表れないが、`Version`は自己参照で`derived_from_version_id`を持つ（別Representation配下のVersionを指すことが普通にある。4.0.2節参照）。また`Title ─< TitleRepresentationType`という、Cutのライフサイクルとは独立したTitle単位の設定投影も別途存在する（同節）。

## 4.0.1 なぜTimelineItemを導入するか

現在の実装対象はCutだけだが、Jijiの本体は「Cutの集合」ではなく「更新され続ける1本のTimeline」である（要件定義1.2節）。将来的にOP・ED・CM・提供・アイキャッチ、あるいは劇場版・配信版といったCutではないTimeline構成要素が必ず出てくる。これらをあとから追加しようとすると、Cutを中心に組んだスキーマ・投影・UIコンポーネントを作り直すことになる。

そこで最初から`timeline_item`を共通の台帳として置き、Cutはその一種（サブタイプ）として実装する。`cut.id`を`timeline_item.id`と共有するクラステーブル継承にすることで、`cut_asset` / `submission` / `issue`など既存の`cut_id`参照は一切変更しなくてよい。Audio/Transition/Markerは将来`timeline_item.type`の新しい値として追加し、必要ならCutと同様の詳細テーブル（`audio`等）を足すだけで済む。

**MVP（要件定義13章 Phase 1〜2）で実装するのはCutのみ**。他の種別はスキーマ上の余地として用意するに留め、実装は後回しにする。

## 4.0.2 なぜRepresentationを導入するか

要件定義v0.3で追加されたCut Lineage（要件定義1.2節・4.4節）を物理モデルに落とす。v0.2までの`submission`/`version`はCutに直接ぶら下がる1段構成だったが、これだと「Storyboardの版」と「Compositeの版」が同じ連番空間に混在し、「Representationごとの最新版/採用版」（要件定義6.2節）を表現できない。

そこで`cut`と`submission`の間に`representation`を挟む2段構成にする（Cut → Representation → Submission → Version）。`representation.type`のカタログは固定enumとし、7章の工程DAGと同じく**ユーザーが任意の名前を自由に追加できるワークフロー要素にはしない**——要件定義14章のリスク「Representationの増加によるモデル複雑化」と、P-06「制作現場の入力を増やさない」への対応でもある。

**ただし、このカタログのうちどれをそのプロジェクトで使うかはTitle単位で選べる**（`title_representation_type`、チェックボックスで有効/無効を切り替えるプロジェクト設定UI）。スタジオごとに工程の切り方・呼び方は異なり、Jijiが特定のスタジオの分業をUIに固定化してしまうのは避けたい。固定enumで「新しい種類を勝手に生やせない」という歯止めは保ったまま、「標準カタログのうちどれを使うか」というサブセット選択だけはスタジオに委ねる、という折衷である。設定が一度も行われていないTitleは全種類が有効という既定になる（P-06: 新規プロジェクトは今までどおりセットアップ無しで使える）。無効化しても、既に提出済みのRepresentation・Versionは履歴として引き続き見える（P-04）——無効化は「今後の新規提出を止める」だけの意味であり、過去を消す操作ではない。この設定変更自体も`RepresentationTypesConfigured`イベントとして記録する（Cut自体のライフサイクルとは別の、Title単位の`title-representation-config`ストリーム）。

`asset`（3D/美術で使い回す共有素材）への提出はRepresentationを経由しない。AssetはCutと違い「絵コンテ→完パケ」という時間軸を持たず、7章のAsset DAG（モデリング→リグ→ルックデブ）で完結するため、`submission.representation_id`はcut向け提出でのみ必須とする。

EXRのAOV（beauty/diffuse/specular/normal等）やPSDのレイヤー、PNGのアルファ有無等は、独立したRepresentation/Versionにはしない。1つのVersionが内部に持つメタデータ（`version.artifact_metadata`）として扱う（要件定義6.1節、F-25）。具体的なJSON形状は10章「未決定事項」参照。

さらに、Versionは「どのVersionから作られたか」という制作上の因果関係（`derived_from_version_id`/`derived_from_relation`）を持てる。Representationごとの版番号（seq）はあくまで提出順の連番でしかなく、それだけでは「Layout v5から作画してAnimation v1ができた」という**別Representationをまたいだ派生元**は表現できない。Cut Lineageの本質は個々のRepresentation列ではなくこの派生関係にあるため、Versionの物理設計として持たせている。関係の種類は`refined`（改稿）/`converted`（変換）/`replaced`（差し替え）の3種（representation.tsのDerivedFromRelation参照）。

## 4.1 投影テーブル（CQRS読み取りモデル）

`event`が正本。以下は2.3節のCore `project`関数が同一トランザクションで計算・更新する読み取り専用テーブルで、画面表示はこれらだけを読む。

| テーブル | 内容 | 更新元イベント |
|---|---|---|
| `issue_state` | issue_id, status, closer_id, opened_at, closed_at, close_reason | Issue関連イベント |
| `representation_current_version` | representation_id, latest_version_id, approved_version_id | Version提出・Seal。「最新版」「採用版」はRepresentation単位（Storyboardの採用版とCompositeの採用版は別物。要件定義6.2節） |
| `timeline_band_view` | episode_id, timeline_item_id, item_type, offset_frames, width_frames, process_status(json, cut以外はNULL) | TimelineItem配置イベント／Cut/Submission/Review関連イベント。process_statusはRepresentation種別をキーにしたマップ（例：`{"layout": {...}, "animation": {...}}`）。7.1節の工程バーはここから引く。7.4節のプレイヘッド同期はこの投影から現在位置直下の要素を逆引きする |
| `membership_state` | person_id, scope_type, scope_id, permission_level, process_scope, granted_at, expires_at, revoked_at | Membership関連イベント。`is_active`は保存せず、クエリ時に現在時刻と`expires_at`/`revoked_at`を比較して算出する（8.3節） |

---

# 5. イベントログ / ハッシュチェーン設計

要件書9章「何が起きたかを、後から消せない」を実装レベルに落とす。

```text
event[n].hash = SHA-256( event[n-1].hash + canonical_json(event[n].payload, event[n].created_at, event[n].type) )
```

* ハッシュ計算そのものは`lib/core/event-hash.ts`の純粋関数として実装する（2.1節）。Shellは計算結果を`event`テーブルに書き込むだけ
* `event`テーブルへの`UPDATE`/`DELETE`はDBトリガー（SQLite）またはD1側の制約で禁止し、リポジトリ関数も`insert`しか公開しない
* `prev_hash`はタイムライン単位（またはターゲット単位）で直前の`event.hash`を参照する
* 監査証跡パック出力（F-36, Should）は、この列を先頭から検証してチェーンの整合性を確認したうえでPDF/CSVに変換する

---

# 6. プロキシ生成パイプライン

## 6.1 MVP

素材提出 → 正規化プロキシ生成（解像度・fps・コーデック統一、静止画は尺分の動画に変換）→ 話数単位で1本の結合プロキシを再生成、という単純な方式でよい。

```text
Submission → ffmpeg(normalize) → Proxy(cut単位)
                                        ↓
                    変更のあった話数のみ ffmpeg(concat) → Proxy(episode単位, mp4)
```

* ffmpeg起動はBunのサブプロセス（`Bun.spawn`）でキュー管理。同時実行数を制限する
* 差分検知：カットの最新プロキシ生成時刻 vs 話数結合プロキシの生成時刻を比較し、古ければ再結合対象に入れる
* 生成はバックグラウンドジョブ（要件N-19相当）。UIをブロックしない

## 6.2 将来案（segment化）

話数ごとに毎回1本を結合し直す方式は、300カット規模になると再生成コストが無視できなくなる可能性がある。将来的には次の構造に移行できるようにしておく。

```text
Timeline
 ├─ Segment 001 (Cut単位のプロキシ)
 ├─ Segment 002
 ├─ Segment 003
 └─ ...

再生時: Timeline → Segment Manifest → Media Source Extensions → Player
```

**MVPではMSEを実装しない。** 単純結合プロキシで十分。segment化はスキーマ上`version.proxy_ref`が個別に参照可能な設計にしておくことで、後から無理なく移行できるようにするに留める。

## 6.3 Representation種別ごとの生成方針

6.1節の「正規化プロキシ生成」は動画・静止画を前提にしていたが、Cut Lineage（要件定義4.4節）が扱う形式はそれだけではない。PSD・EXR・AEPはffmpegで直接扱えない、あるいは扱う意味が異なる（F-23）。

| Representation | 入力形式 | MVPでの扱い |
|---|---|---|
| Storyboard | PNG / PDF | 静止画→尺分の動画化（6.1節のまま） |
| Animatic | MP4 | 既存パイプラインでそのまま正規化 |
| Layout / BG | PSD | レイヤーをflatten統合した1枚のPNGを書き出し、静止画と同様に尺分動画化。個別レイヤー情報は`version.layer_metadata`（4.0.2節）に記録するのみでプロキシ生成の対象にはしない（F-38はShould） |
| Animation | PSD / 連番PNG | 連番PNGをffmpeg `image2`concatで動画化 |
| CG Render | EXR（マルチAOV） | 既定AOV（通常beauty）のみをトーンマッピングしてPNG/動画化。他AOVは`version.layer_metadata`に一覧を記録するだけでプロキシは生成しない（AOV情報取得＝F-25はMust、AOV個別プロキシ生成はCould以降） |
| Composite | AEP / PSD / EXR | **AEPはffmpegで直接プロキシ生成できない**。AE側で書き出し済みの動画/画像があればそれを対象にする。AEPそのものからはメタデータ（レイヤー構成・素材参照）のみを取得する（F-40 DCC Metadata取得、F-41 AE/Nuke依存解析。いずれもShould） |
| Final | ProRes / MP4 | 既存パイプラインでそのまま正規化 |

**MVPで実際にプロキシを生成するのは「動画化できる形式」のみ**（Storyboard/Animatic/Layout/BG/Animation/CG Render beauty/Final）。AEP等のDCCプロジェクトファイルはメタデータ取得に留め、プロキシパイプラインの対象外とする。これにより6.1節の単純な結合方式（差分検知・バックグラウンドジョブ）をRepresentation横断でそのまま再利用できる。

---

# 7. UI設計

## 7.1 画面レイアウト（ワイヤーフレーム）

```text
┌─────────────────────────────────────────┐
│ Episode 03                         24:00 │
├─────────────────────────────────────────┤
│                    │                    │
│  [C01][C02][ C03 ]│[C04][ C05 ]          │
│                    │                    │
│  LO     ███████████│████               │
│  作画        ██████│██████             │
│  3D          ██████│████               │
│  BG       ████████│████████            │
│  撮影             █│█████               │
│                    │                    │
├─────────────────────────────────────────┤
│                    ↕ 現在地カーソル       │
│         ▶ 00:12:34   C03 / 演出待ち     │
│                       担当: 佐藤        │
└─────────────────────────────────────────┘
```

現在地カーソル（縦線）はPlayerの再生位置・Timelineの帯・工程バーを貫通し、常にどのカット／どの工程／誰の手番かを1点で示す（7.4節）。

## 7.2 コンポーネント構成（案）

```text
routes/(app)/[title]/[season]/[episode]/+page.svelte
  └─ TimelineViewer.svelte         … playheadFrame（現在地）を所有するオーナー
       ├─ Minimap.svelte
       ├─ Playhead.svelte          … 現在地カーソル（縦線）。7.4節
       ├─ CutTrack.svelte          … 帯本体。カット幅=尺
       │    └─ CutBar.svelte × N   … 仮想スクロールで描画。クリックでCut Evolution Viewer（7.5節）へ遷移
       ├─ ProcessLanes.svelte      … LO/作画/3D/BG/撮影の工程バー
       └─ PlayerPane.svelte        … 結合プロキシの再生（HTML5 video）
```

## 7.3 仮想スクロール（性能要件 N-17: 300カットを1秒以内）

* カットDOMは可視範囲＋バッファ分のみ描画。`IntersectionObserver`または位置計算ベースのwindowingを使う
* 帯の横軸はコマ数から算出したpx位置にマッピングする純粋関数を用意し、スクロール位置とは独立に計算できるようにする

## 7.4 現在地カーソル（プレイヘッド同期）

Premiere/AE的な「現在地カーソル」を、Player・Timeline・工程・担当者の橋渡し役として置く。動画の再生位置から今どのカットの誰の手番かへ、逆にTimeline上の任意の位置から動画のその瞬間へ、双方向にジャンプできることがJijiの差別化点になる。

```text
動画再生位置（video.currentTime）
        ↕  frame ⇄ 秒（基準fps換算）
Timeline位置（playheadFrame）
        ↕  timeline_band_view から逆引き（7.3節のoffset⇄px写像の逆関数）
現在のTimelineItem（Cut等）
        ↕  representation_current_version / process_status
現在工程
        ↕  membership_state（process_scope × permission_level）
担当者
```

* `playheadFrame`はTimelineViewer.svelteが持つ単一の共有状態（Svelte 5 `$state`）。CutTrack/ProcessLanes/Playhead/PlayerPaneはこれを読み書きするだけで、互いを直接参照しない
* PlayerPaneの`timeupdate`イベント → `playheadFrame`を更新（動画→Timeline方向）
* Timeline上でのスクラブ／クリック → `playheadFrame`を更新 → PlayerPaneが`video.currentTime`をシーク（Timeline→動画方向）
* `playheadFrame`から現在のTimelineItemを引く関数は、7.3節のoffset計算と同じ「コマ数⇄px」の純粋関数を再利用する（Core、`lib/core/timeline-item.ts`）。カット位置が分かれば`timeline_band_view`から現在工程、`membership_state`から`process_scope`が一致する担当者を引ける
* 担当者が複数（例：contributor複数名）いる工程では、直近の`submission.submitted_by`を優先表示する

## 7.5 Cut Evolution Viewer（Cut Lineage表示）

要件定義12章のCut Evolution Viewerを、TimelineViewerからの詳細ビューとして実装する。CutBar（7.2節）のクリックで開く、Representationを横に並べたパネル。

```text
┌─ C-125 Cut Evolution ──────────────────────────────────┐
│ Storyboard   Layout    Animation   CG Render   Composite │
│ ┌────┐      ┌────┐    ┌────┐      ┌────┐      ┌────┐    │
│ │thumb│ ──▶ │thumb│──▶│thumb│ ──▶ │thumb│ ──▶ │thumb│    │
│ └────┘      └────┘    └────┘      └────┘      └────┘    │
│ v01 採用     v02 採用   v03 最新    v01 採用    v02 最新   │
│                                                            │
│              [ 比較再生 ▶ ]  ← F-27。2枚を左右/オーバーレイ │
└────────────────────────────────────────────────────────┘
```

* ルート：`routes/(app)/[title]/[season]/[episode]/cuts/[cutId]/+page.svelte`。TimelineViewer上のCutBarからの遷移のみを入口とし、独立したナビゲーション項目は置かない（要件定義P-01：タイムラインが正規の作品表現である）
* 各カラムは`representation_current_version`投影（4.1節）を読むだけで、最新版/採用版の両方を表示する
* 「比較再生」（F-27）は2つのVersionのプロキシを同期再生する。既存のPlayerPane（7.2節）を2インスタンス並べるが、`playheadFrame`（7.4節、Timeline全体で共有）とは状態を分離し、このビュー内だけで完結する個別の再生位置を持たせる
* EXRのAOV切替やPSDレイヤー比較（F-25, F-38, F-39）は、CG Render/Layoutカラム内のサブUIとして持たせる想定。詳細ワイヤーフレームはShould実装時に検討する

---

# 8. ユーザー管理・認証・共有リンク設計

これまでの設計にはPerson/Roleの物理テーブルはあったが、「誰が・どの範囲に・いつまでアクセスできるか」を管理する概念が抜けていた。国産アニメ制作は**1話だけ参加する原画マン・動画マンのような短期スタッフが常態**であり、アクセス権の付与と失効そのものを一級の設計対象にする必要がある。

## 8.1 概念モデル：Googleスプレッドシートの共有を踏襲

Jijiのユーザー管理は、ゼロから設計せず、現場のスタッフが直感的に理解できるGoogleスプレッドシートの共有モデルを踏襲する。

| Googleスプレッドシートの概念 | Jijiでの対応 |
|---|---|
| フォルダ全体ではなく個別ファイルを共有できる | Title全体、または話数（Timeline）単位で共有範囲を選べる（`membership.scope_type` / `scope_id`） |
| 権限レベル（閲覧者・コメント可能・編集者・オーナー） | `permission_level`：viewer / contributor / reviewer / admin の4段階（8.2節） |
| 「特定のユーザーを追加」 vs 「リンクを知っている全員」 | 名前付きアカウント（`membership`）vs 軽量ID共有リンク（`share_link`＋Magic Identity）の二経路。後者も既定では名前入力を伴う軽量IDであり、完全匿名ではない（8.5節） |
| 個々の共有設定に対する有効期限（Google Workspace機能） | `membership.expires_at`。単話参加者への対応の核（8.3節） |
| オーナーを0人にはできない | Titleごとにadmin権限のmembershipが最低1人残ることを`decide`で保証する（8.3節） |

Jijiは「リンクを知っている全員が編集可」に相当する組織全体アクセスを持たない。エアギャップ・全アクセス監査（要件N-01/F-15）と衝突するため、内部スタッフも含め**全員が個別のmembershipを持つ**ことを原則とする。

## 8.2 データモデル：`membership`

物理設計は4章のとおり（`membership`テーブル）。ポイントは以下。

* **scope**：`scope_type`が`title`なら作品全体、`timeline`なら話数単位。1話だけ参加する外部スタッフには`timeline`スコープでmembershipを与え、他の話数には一切アクセスできないようにする
* **permission_level**：閉栓権や管理操作の可否はここで判定する（2.2節の「閉栓権チェック」の実体）
  * `viewer`：閲覧・通し再生のみ（監督試写、クライアント確認など）
  * `contributor`：素材提出・バージョン追加ができる（原画・動画・仕上・3D等）
  * `reviewer`：レビュー入力・Issue起票／クローズができる（演出・作画監督等）
  * `admin`：上記に加えメンバー管理・Seal操作ができる（制作進行・監督等）
* **process_scope**：`role`テーブルから引き継いだ工程限定。原画マンならこのmembershipの`process_scope`を`["作画"]`に絞り、他工程のcontributor権限は持たせない
* **granted_by / revoked_by**：誰が権限を与え・剥奪したかを記録し、F-15（全アクセス監査）に応える

権限の付与・変更・失効は`event`テーブルに`MembershipGranted` / `MembershipUpdated` / `MembershipRevoked`として記録する（P-04「過去は消さない」）。一方で**期限切れ自体はイベントにしない**——`expires_at`を過ぎたという事実は付与時点のイベントから常に再計算できるため、時計が進んだだけで発生する「誰の操作でもないイベント」を追加しない。これはCoreの純粋関数`isActive(membership, now)`が担う。

```text
isActive(membership, now) =
  membership.revoked_at == null
  && (membership.expires_at == null || now < membership.expires_at)
```

## 8.3 有効期限とライフサイクル（単話参加者への対応）

* `expires_at`はNULL可。恒常スタッフ（社員の制作進行・監督など）は無期限のまま運用できる
* ただし次の場合はアプリ層（Shellのコマンドハンドラ）で`expires_at`の指定を必須化する：
  * `person.account_type = external`（外部スタッフ）
  * `scope_type = timeline`（話数単位の付与＝典型的な単話参加）
* 既定値はUI側で提案する。話数単位なら「その話数のクランクアップ予定日＋一定バッファ」、作品単位の外部委託なら`share_link`と同じ既定7日・最長90日を流用する
* 失効判定はセッション確立時だけでなく**リクエスト毎**にクエリ側（`membership_state`投影＋`isActive`）で再評価する。ログイン済みセッションが残っていても、期限が来た瞬間に以降のアクセスは拒否される
* **最後のadminロックアウト防止**：あるTitleでadmin権限を持つ有効なmembershipが1件だけの状態から、それを失効・降格させる操作は`decide`が拒否する（Google Workspaceの共有ドライブで最後のマネージャーを外せないのと同じ制約）

## 8.4 内部ユーザー認証

| 対象 | 方式 | 実装メモ |
|---|---|---|
| 内部ユーザー | ID/パスワード + TOTP | 外部通信ゼロ要件（N-01相当）を満たすため、TOTP検証はローカル完結のライブラリを使う（QRコード生成も外部CDN不使用）。ログイン成功後もリクエスト毎にmembershipの`isActive`を再検証する |

## 8.5 外部作業者：Magic Identity（既定）と署名付き共有リンク

### 8.5.1 なぜ完全匿名を既定にしないか

`share_link`単体で完結する完全匿名の提出は運用上は楽だが、**「誰が提出したか分からない」は制作現場では事故になる**。これはF-15（全アクセス監査）・P-04（過去は消さない）と本質的に矛盾する。したがって**書き込み（提出・レビュー）を伴う共有リンクでは、完全匿名を既定にしない**。

### 8.5.2 Magic Identity方式（既定）

名前だけを入力させ、メールアドレス・パスワードは要求しない軽量な本人識別。「匿名」ではなく「軽量ID」として扱う。

```text
制作進行: 佐藤さんにC-125を依頼
   ↓
Jiji: https://jiji.example/invite/abc （招待リンクを送付）
   ↓
佐藤: リンクを開く → 名前を入力（メール/パスワード不要）
   ↓
Jiji内部: person（account_type=external, name="佐藤"）を作成し、
          share_linkにひも付くtoken認証でセッションを開始
```

* 実装上は`share_link`（`permission_level = contributor`）を開いた初回アクセスで名前入力フォームを挟む。入力された名前で`person`（`account_type = external`）を作成し、`share_link.claimed_person_id`に記録する
* 以降のアクセスは同じトークン（署名付きCookie等）でその`person`として扱われる。ID/PWは発行しない——**認証はトークン、識別は名前**という役割分担にする
* 提出・レビューはすべてこの`person_id`で記録されるため、Version/Reviewの記名（F-15）が自動的に満たされる
* 同一人物が別トークン（別リンク）で来た場合の名寄せはしない（MVPでは「同一トークン＝同一人物」のみ保証する）。名寄せ・長期追跡が要る場合は8.5.4節を使う

### 8.5.3 完全匿名を許してよい場合（例外）

閲覧専用（`share_link.permission_level = viewer`）で状態を一切変更しない共有（監督試写用のクライアント確認URLなど）は、名前入力を省略してよい。書き込みが発生しない限り「誰が見たか」の欠落は事故に直結しないため。

### 8.5.4 個人を強く特定したい場合：`person` + `membership`

1話だけ関わる外部スタッフでも、複数話・長期間にわたり同一人物として追跡したい場合はMagic Identityではなくこちらを使う。

| 状況 | 選択肢 |
|---|---|
| 複数話・長期間にわたり同一人物として追跡したい、ログインを求めてよい | `person`（external）＋`timeline`スコープの`membership`。期限は8.3節のとおり必須化 |
| 単発の依頼で、その場限りの軽量な本人識別で足りる（既定） | 8.5.2節のMagic Identity |

### 8.5.5 データモデル

`share_link`に`permission_level`（viewer/contributor）と`claimed_person_id`（nullable, FK→person）を持つ（4章）。`contributor`は名前入力を必須化し、`viewer`は任意とする判定に使う。

## 8.6 メンバー管理画面（概念ワイヤーフレーム）

要件定義12章のとおり「メニューや管理画面は作品の裏側に置く」。作品ごとの裏側画面として、以下のような一覧を持つ。

```text
┌─ 作品「〇〇」メンバー ────────────────────────────────┐
│ 名前         権限          範囲          有効期限        │
│ 山田太郎     admin        作品全体      無期限          │
│ 鈴木花子     reviewer     作品全体      無期限          │
│ 佐藤次郎     contributor  Ep.05 のみ    2026-09-30      │
│ 外部スタジオA contributor  Ep.05 のみ    2026-09-30      │
│                                              [+ 招待]   │
└─────────────────────────────────────────────────────┘
```

有効期限が近い（例：14日以内）行は色で強調する。色は要件定義12章の原則（装飾ではなく異常・課題・状態の表現のみ）どおり、「期限切れが近い」という状態の表現として使う。

---

# 9. クラウドストレージ連携（Google Drive / Dropbox）

## 9.1 スコープと位置づけ

要件定義P-05（原本を奪わない）・10章の実装として、NAS/S3互換/ローカルに加えて**Google DriveとDropboxを原本の置き場所として選べるようにする**。Jijiが原本を複製せず、参照とメタデータ・イベント・プロキシだけを持つという原則（4章）は変わらない——ストレージのバックエンドが増えるだけである。

* **対応するのはGoogle DriveとDropboxのみ**。Box・SharePointは将来対応（9.5節）
* **既定は無効**。接続を有効化した瞬間、そのJijiインスタンス（少なくとも該当Titleのストレージ）は要件定義9章の「外部通信ゼロ・エアギャップ動作可能」の対象外になる。これは「AI機能は完全分離・既定無効」（要件定義9章）と同じ扱い方であり、機能を使うかどうかは運用側が明示的に選ぶ。有効化した接続先・認可したアカウントは監査ログ（F-15）に記録する

## 9.2 「Webhook URLを貼るだけ」は成立するか：Dropbox ○ / Google Drive ×

調べた結果、DropboxとGoogle Driveでは連携の重さが大きく異なる。「Webhook URLを1個貼れば終わり」という運用はDropboxには当てはまるが、**Google Driveにはそのままでは当てはまらない**。

| | Dropbox | Google Drive |
|---|---|---|
| Webhook登録 | App ConsoleにURLを1つ登録するだけ。DropboxがGETでchallengeパラメータを送り、それを返せば検証完了 | `files.watch` / `changes.watch` をAPI呼び出しで実行して「チャンネル」を作る。UIにURLを貼って終わり、ではない |
| 事前準備 | Appキー登録のみ | **受信ドメインの所有権をGoogle Search Console＋Cloud ConsoleのDomain verificationで事前検証**しないと通知そのものを受け取れない |
| 認可 | OAuth 2.0（対象Dropboxアカウントの連携） | OAuth 2.0（対象Google Drive/共有ドライブへのアクセス許可） |
| チャンネルの寿命 | 明示的な失効なし。登録したら継続 | **`files.watch`は最大1日、`changes.watch`は最大1週間で自動失効**。自動更新機構は無く、期限前に新チャンネルを再作成するジョブが必須 |
| 通知の中身 | 変更のあったアカウント等の情報（詳細は別途API呼び出しで取得） | **通知はほぼ空のping**。`X-Goog-Resource-State`等のヘッダのみで、実際に何が変わったかは`changes.list`を別途呼んで調べる必要がある |
| 受信要件 | 公開HTTPS＋有効なSSL証明書 | 公開HTTPS＋有効なSSL証明書（自己署名不可） |

出典: [Google Drive push notifications](https://developers.google.com/workspace/drive/api/guides/push) / [Domain verification](https://support.google.com/googleapi/answer/7072069) / [Dropbox Webhooks](https://www.dropbox.com/developers/reference/webhooks)

## 9.3 セルフホスト前提との衝突：どちらも「公開HTTPS受信」を要求する

Push通知（Dropbox webhook、Google Drive watch channel）は共通して「外部サービスがJijiに向けてPOSTできる公開HTTPSエンドポイント」を要求する。しかしJijiの既定配布形態（1.1節）はセルフホスト＝スタジオのローカルマシン／エアギャップ環境であり、公開ドメインもリバースプロキシも前提にしていない。ホスティングSaaS版（Cloudflare Workers）は既に公開ドメインを持つため問題にならないが、それはJijiの主要な配布形態ではない。

**したがってMVPはポーリング方式を既定とする。**

```text
セルフホスト（既定）:
  Jiji（バックグラウンドジョブ、6章のプロキシ生成キューと同種）
      │ 一定間隔（既定5分、設定可）でoutboundのみ
      ▼
  Google Drive changes.list(pageToken) / Dropbox files/list_folder/continue(cursor)
      │ 差分のみ取得（全件走査は不要）
      ▼
  差分があれば Submission + Version を自動生成 → 6章のプロキシ生成へ

ホスティングSaaS（将来・任意）:
  上記に加えてDropbox webhookで即時トリガー可能（Workersは公開ドメインを持つため）
  Google Driveのpush通知は、運用者が一度ドメイン検証を済ませれば利用可
  （9.2節の制約が重いため優先度は低く、6.2節の「segment化」と同様に将来の最適化として位置づける）
```

ポーリングはoutbound通信のみで完結し、Jiji側に受信ポートを一切開けない。エアギャップ原則からの逸脱を「接続を有効化した分だけ」に最小化できる。Google Drive / Dropbox いずれもカーソル/ページトークン方式（`startPageToken` / `cursor`）を持つため、ポーリングでも差分だけを取得でき、無駄なフル同期にはならない。

## 9.4 データモデルへの反映

4章の物理設計に追加する新テーブル（Should、F-42）:

| テーブル | 主なカラム | 設計上の注意 |
|---|---|---|
| `storage_connector` | id, title_id, provider(google_drive/dropbox), auth_ref, root_folder_ref, sync_cursor(nullable), enabled(bool, 既定false), created_by, created_at | `auth_ref`はOAuthトークンそのものではなく参照。トークンの実体をどこに保存するか（DB暗号化 or 外部secret store）は10章「未決定事項」 |

`representation` / `submission`が持つ`file_ref`（4章）は、クラウド接続時は`storage_connector_id`を介して解決するfile ID/パスを保持する。既存の`storage-ref.ts`（3章：NAS/S3互換/ローカル参照アダプタ）にproviderの分岐を足すだけで済み、Cut/Representation/Version自体の構造（4.0.2節）には影響しない——ストレージ種別が増えるだけである。

クラウド上のどのファイルがどのCutのどのRepresentationに対応するかというマッピング規則（フォルダ命名規約か、マッピングUIか）は未確定。10章「未決定事項」参照。

## 9.5 Box / SharePointへの拡張（将来）

将来対応時も9.3節のポーリング方式をそのまま踏襲できる見込み：BoxはEvents API（ポーリング可）、SharePoint/OneDriveはMicrosoft Graph Delta Query（`/delta`。Google/Dropboxと同じカーソル方式）を持つため、`storage_connector.provider`の選択肢を増やすだけで対応できそうである。ただし各APIの認可方式（Box: OAuth 2.0、SharePoint: Microsoft Entra ID経由）は個別調査が要る。要件定義には未記載のため、着手する場合は先に要件定義のShould/Couldに項目を追加する。

---

# 10. 未決定事項

* DuckDBの採用方法：TypeScript環境からの利用手段（Node/Bun向けバインディング or WASM）。イベントログ分析用途にSQLite側の集計クエリで代替できないかを含めて検討する
* Cloudflare D1版のffmpeg実行手段（Workers上ではネイティブプロセスが起動できないため、ホスティングSaaS版のプロキシ生成方式を別途設計する）
* 投影テーブルの再構築手段：スキーマ変更やバグ修正後に`event`からの一括リプレイで投影テーブルを作り直すバッチ処理の設計
* membershipの期限切れ通知：期限が近いメンバーを制作進行に事前通知する手段（UIバッジのみで足りるか、メール等の能動的通知が要るか）。外部通信ゼロ原則との整合を含めて検討する
* membershipの失効反映タイミング：リクエスト毎の`isActive`再評価で十分か、長時間セッションを能動的に切断する仕組み（WebSocket等）が要るか
* Magic Identityのトークン運用：端末紛失・トークン漏洩時の再発行／失効フロー。同一人物が複数トークンを持った場合に`person`を統合する手段の要否
* TimelineItemの他種別（Audio/Transition/Marker）に7章の工程DAGをどこまで適用するか。OP/ED/CM・劇場版/配信版への拡張時に再検討する
* 現在地カーソル（7.4節）の同期粒度とパフォーマンス：フレーム単位で追従させるか一定間隔に間引くか、スクラブ中の再描画コスト
* `version.artifact_metadata`（EXR AOV/PSDレイヤー情報、4.0.2節）の具体的なJSON形状：AOV名・レイヤー名一覧だけで足りるか、解像度・カラースペース・ビット深度等も持つか
* EXRのトーンマッピング方式（6.3節）：OCIO設定をJiji側で管理するか、素材提出側に正規化済みLUT適用済みの書き出しを求めるか
* AEP/Nukeスクリプトのメタデータ抽出手段（F-40, F-41）：パーサライブラリの選定。AE/Nuke本体を必要としないオフライン解析が可能か
* Representationの標準typeカタログ（storyboard/animatic/layout/animation/bg/cg_render/composite/final）は、どのプロジェクトで使うかはTitle単位のチェックボックスで選べるようにした（4.0.2節改訂）。残る論点は「この8種のカタログ自体が全スタジオをカバーしきれているか」——カタログに無い種類が必要なスタジオが出てきた場合、(a) カタログに新項目を足す（固定enumのまま増やす。全プロジェクト共通の選択肢が増えるだけ）か、(b) Titleごとの自由記述を許す（固定enumの前提を崩す）か。前者で足りる間はPhase 0的な実データ収集は急がなくてよい
* Representationの派生関係（`derived_from_relation`: refined/converted/replaced、4.0.2節）は3種で十分か。Cut Lineageの可視化（Cut Evolution Viewer）を実際に使ってみてから見直す
* クラウドストレージ連携（9章）のOAuthトークン保存方式：DBに暗号化して持つか、OS keychain相当／外部secret storeを参照する形にするか
* クラウドストレージ連携（9章）のフォルダ⇔Cut/Representationマッピング規約：固定の階層命名（例：`/C-125/Layout/`）をスタジオに要求するか、Jiji側にマッピングUIを用意して任意のフォルダ構成を許すか
* クラウドストレージ連携（9章）のポーリング間隔：既定5分は妥当か。Title/Timelineごとに変更可能にする必要があるか
