# Jiji — 開発ガイド（CLAUDE.md）

このファイルは、次にこのリポジトリを開くセッション（自分自身を含む）向けの実務ガイド。
「何を作るか」は `doc/requirements.md`、「どう作るか」の設計判断は `doc/design.md` が正本。
このファイルはその2つを前提に、**このリポジトリで実際に手を動かすときの手順と、ハマった場所**をまとめる。

> `doc/requirements.md` はユーザーが対話しながら頻繁に書き直す。引用する前に必ず現物を読み、章番号やバージョン（現在v0.3）が古くないか疑うこと。

---

## 1. プロジェクトの一文要約

Jiji は国産TVアニメ制作向けの「Living Timeline」作品管理ツール。絵コンテから完パケまで、作品を1本のタイムラインとして扱う。進捗率もタスク管理も持たない。工程は状態フラグではなくイベント履歴（P-03: 工程は状態ではなく履歴である）。詳細は `doc/requirements.md` の設計原則（2章）を参照。

## 2. アーキテクチャの確定事項

- **SvelteKit（TypeScript）+ Bun ランタイム**、単一デプロイ単位。独立したAPIサーバは持たない（design.md 1.2節）
- **FCIS（Functional Core / Imperative Shell）+ CQRS**（design.md 2章）
  - `src/lib/core/**`：純粋関数のみ。DB・時刻・乱数・ネットワークに触れない。`decide`（意思決定）/`evolve`（イベント畳み込み）/`project`（投影計算）の3種
  - `src/lib/server/shell/**`：副作用を担う。`repository/`（Drizzleクエリ）・`commands/`（decide呼び出し＋event追記＋投影更新を同一トランザクションで）・`queries/`（投影テーブル読み出し）
  - 判定基準：「時刻・乱数・DB・ネットワークに触れずVitestで即テストできるか」→ Core、そうでなければ Shell
- **イベントソーシング**：`event` テーブルは追記専用（design.md 5章）。ハッシュチェーンは `lib/core/event-hash.ts`。ターゲット単位（タイムライン単位）でチェーンする
- **DB**: Drizzle ORMで抽象化し、セルフホスト（既定）=SQLite、ホスティングSaaS（将来）=Cloudflare D1 を同一スキーマ・同一クエリコードで両立させる（design.md 1.1節）

## 3. 今回の実装スコープ

**実装済み**（design.md 13章 Phase1 相当 + ユーザー管理）:
- Timeline / Cut の作成（Title→Timeline→Cut、`timeline_item`+`cut`のクラステーブル継承。design.md 4.0.1節）
- Membership（design.md 8章）：Googleスプレッドシート共有を踏襲。scope_type(title/timeline) × permission_level(viewer/contributor/reviewer/admin) × 有効期限。Title作成者は自動でadminになる。最後のadminロックアウト防止をdecideで保証
- ShareLink + Magic Identity（design.md 8.5節）：外部作業者向け時限リンク。contributor権限は初回アクセス時に名前入力（メール・パスワード不要）で`person`(external)を作成
- 9テーマ×light/dark=18通りのUIテーマシステム（後述7章）
- 社内Relay（design.md 9.6節）：register/heartbeat/「今すぐ取得」（object storageのlist scan発見→claim→取得→検証→削除）まで一通り実装済み。Submission機能が無いためjobは出稿ではなくbucket直下のlist scanで発見する簡略実装。ヘッダーの接続バッジ（`RelayConnectionBadge.svelte`）とログイン時の自動再接続（`relay-connection.svelte.ts`）も実装済み。gcs/azure_blob providerとステージング書込み（`.jiji-part-{jobId}`→rename）は未実装（design.md 9.6.2・9.6.5・10章参照）

**未実装**（意図的に範囲外。次にやるならここ）:
- Submission / Version / Review / Seal / Issue（design.md 13章 Phase 2〜3相当）。これが無いためRelayのjobは出稿ではなくlist scan発見に頼っている（design.md 9.6.5節）
- Asset / CutAsset（Should機能）
- ffmpegプロキシ生成パイプライン（design.md 6章）
- 内部ユーザーのTOTP本実装（今は `/dev-login` の開発用スタブのみ。`lib/server/auth/internal.ts`参照）
- Cloudflare D1への実接続・Workersへのデプロイ（`adapter-auto`のまま。7章参照）
- 仮想スクロール・ミニマップ・通し再生プレイヤー・現在地カーソル（design.md 7.4節）

## 4. 開発環境の既知の制約（重要・ここでハマった）

### better-sqlite3 はこの環境でsegfaultする

Windows + Git Bash環境で、`better-sqlite3`の`require()`が**Node・Bun両方で**セグフォルトすることを確認済み（drizzle-kit経由でなく、素の`new Database()`単体でも再現）。ネイティブアドオンのABI不整合と思われる。**このリポジトリでは`better-sqlite3`を使わない**。

### `bun:sqlite` は Vite の SSR モジュールグラフ経由だと読み込めない

`bun run dev`のトップレベルプロセスはBunでも、Vite/SvelteKitのSSRモジュールランナーは内部でNodeのESMローダーを経由することがあり、`import { Database } from 'bun:sqlite'`が`ERR_UNSUPPORTED_ESM_URL_SCHEME`で落ちた（"Received protocol 'bun:'"）。CLIスクリプト単体（`bun run scripts/foo.ts`）では問題なく動くが、SvelteKitアプリのコードからは使えない。

### → 解決策：`@libsql/client` + `drizzle-orm/libsql`

アプリのSQLite接続は `@libsql/client`（ネイティブアドオン不要、Node/Bun両対応、ViteのSつまり`SSR経由でも動作確認済み）を使う。ドライバの結果種別が`'async'`になるため、**Shell層（repository/commands/queries）は全面的に`async`/`await`**（D1も元々async、結果として`SqliteDb`/`Db`型は統一的にasync）。実装は `src/lib/server/db/index.ts` を参照。

### `drizzle-kit push` / `migrate` / `studio` はこの環境では動かない

これらはdrizzle-kit自身がライブDB接続用のネイティブドライバ（better-sqlite3等）を要求するため、上記のsegfaultを踏む。**代わりに**:

```bash
bun run db:generate   # schema.ts → drizzle/*.sqlのSQL生成（静的解析のみ、問題なく動く）
bun run db:apply      # 生成されたSQLを bun:sqlite で直接適用（scripts/apply-migrations.ts）
```

`db:apply`は`bun:sqlite`を直接使うが、これは`bun run scripts/apply-migrations.ts`として**CLIから直接**起動するので上記のVite SSR問題を踏まない。`db:push`/`db:migrate`/`db:studio`のnpmスクリプト自体は将来別環境で動く可能性があるので残してあるが、**このマシンでは使わないこと**。

### svelte-check が動かない（TypeScript 7 起因）

このプロジェクトは`typescript@^7.0.2`を使っており、`svelte-check`が「TS7を使うにはTS6も同時にインストールしてtsgoフラグを使え」という趣旨のエラーで即死する。**代わりに**素の`tsc --noEmit`で型チェックする：

```bash
bunx svelte-kit sync && bun x tsc --noEmit -p tsconfig.json
```

`.svelte`ファイル内のテンプレート式の型は拾えないので、Svelteコンポーネントを書いたら`mcp__svelte__svelte-autofixer`（Svelte MCP）で個別に検証すること（このプロジェクトルールとしてSvelte MCPは常時必須）。

### Git Bash + curl で日本語を渡すと文字化けする

`curl -d "name=日本語"`のように非ASCII文字を直接コマンドライン引数に書くと、Windows Git Bash環境ではマルチバイトが化ける（`U+FFFD`混じりの文字化け）。動作確認は文字化けの心配がない経路（実際のブラウザ操作、またはpercent-encodeした本文をファイルに書いて`curl --data @file`）で行うこと。アプリ側のUTF-8処理自体は問題ない（原因はシェル層）。

## 5. 開発フロー

```bash
bun install
bun run db:generate      # スキーマ変更後、SQLマイグレーションを生成
bun run db:apply         # ローカルSQLite（./local.db）に適用
bun run db:seed          # デモデータ投入（scripts/seed.ts）。作品・話数・カット・
                          # メンバー（admin/reviewer/単話contributor）・共有リンクを作成し、
                          # ログイン/確認用URLをコンソールに出す
bun run dev              # vite dev（既定 http://localhost:5173、埋まっていれば5174→5175…）
bun run test             # vitest run（Core層のユニットテスト。43件、5ファイル）
bunx svelte-kit sync && bun x tsc --noEmit -p tsconfig.json   # 型チェック
```

初回ログインは `/dev-login` で `bun run db:seed` が作った内部ユーザー（山田太郎=admin, 鈴木花子=reviewer）を選ぶ。Magic Identity確認は`db:seed`が最後に出力する`/s/<token>`URLを開く。

`DATABASE_PATH`（既定 `./local.db`）は`.env`で設定。`.env.example`も参照。

## 6. コーディング規約（このリポジトリ固有）

- 新しいCoreモジュールを足すときは必ず `decide`/`evolve`（必要なら`project`）の形に揃え、Vitestを同時に書く（`*.spec.ts`）
- Shellのコマンドハンドラは「イベント列取得 → Core evolve → Core decide → 同一トランザクションでevent追記＋投影更新」の型を崩さない。トランザクション内部処理を他コマンドと共有したい場合は`grant-membership.ts`の`grantMembershipInTx`のように「txを受け取る内部関数」を切り出し、公開関数はそれを`db.transaction()`でラップするだけにする（create-title.tsが「Title作成者への自動admin付与」でこのパターンを使っている）
- 権限チェック（`hasAtLeast`, `src/lib/server/shell/authorization.ts`）はルートの`+page.server.ts`側で行う。Shellのコマンド自体は「呼び出し主体が権限を持つか」を検証しない（ドメイン不変条件のみdecideが見る）
- Svelteコンポーネントは書いたら`mcp__svelte__svelte-autofixer`に通す。Svelte 5 runes（`$state`/`$props`/`$derived`）で統一。`$state(prop)`で親のpropを初期値として"種"にするだけの意図的なパターンは`// svelte-ignore state_referenced_locally`を付けてよい（`ThemeSwitcher.svelte`参照）
- フォーマッタ（Prettier + prettier-plugin-tailwindcss）がクラス名を並び替えるので、Tailwindクラスの並び順に神経質にならなくてよい

## 7. UIテーマシステム（9テーマ×light/dark=18通り）

`src/lib/theme.ts`が定義の単一情報源（テーマID・日本語名・Cookie名）。実装の流れ：

1. `src/routes/layout.css`：18通り（各テーマ×モード）の`--color-primary`/`--color-background`/`--color-primary-foreground`をCSSカスタムプロパティで定義し、`surface`/`border`/`foreground`/`muted`はモード共通の式（`color-mix()`）で導出。`danger`/`warning`/`success`はテーマに関わらずlight/dark2通りに固定（要件定義12章「色は状態表現だけに使う」ため、状態色とブランド色を分離）。Tailwind v4の`@theme inline`でこれらを`bg-primary`等のユーティリティにマッピング
2. `src/app.html`：`<html data-theme="%app.theme%" data-mode="%app.mode%">`のプレースホルダ
3. `src/hooks.server.ts`の`handleTheme`：Cookie（`jiji_theme`/`jiji_mode`）を読み、SSR時点で上記プレースホルダを置換（FOUC回避）。`sequence(handleSession, handleTheme, handleParaglide)`の順で合成
4. `src/lib/components/ThemeSwitcher.svelte`：切替UI。`document.documentElement.dataset`を即時更新＋`/api/theme`（`src/routes/api/theme/+server.ts`）にPOSTしてCookie永続化
5. `src/routes/+layout.server.ts`が`theme`/`mode`/`currentPerson`を全ページ共通で読み込み、`+layout.svelte`のヘッダーに渡す

新しいページを追加するときは、ベタなインラインstyleやハードコードした色ではなく `bg-background`/`bg-surface`/`text-foreground`/`text-muted`/`border-border`/`bg-primary`/`text-primary-foreground`/`text-danger`/`text-warning`/`bg-warning-surface`/`text-success` のセマンティックトークンを使うこと。

### Tailwind v4の使い方（CSS-first、意図的に採用しなかった機能を含む）

- `tailwind.config.js`は無い。トークン定義は`layout.css`の`@theme inline`ブロックとCSSカスタムプロパティのみ（v4のCSS-firstな流儀）。`@apply`も使わない
- `color-mix()`の補間空間は`in oklch`（`in srgb`ではない）。sRGB補間は離れた色相同士を混ぜると彩度が落ちて濁るが、OKLCH補間は知覚的に均一。Tailwind v4自身のデフォルトパレットもOKLCHベースなのでそれに合わせた。18テーマの生の`primary`/`background`値自体はユーザー指定の16進コードのまま保持し、そこから導出する`surface`/`border`/`foreground`/`muted`だけをOKLCH空間で計算している
- ブラウザ要件は実質Chrome111+/Safari16.4+/Firefox128+（`color-mix()`とTailwind v4自体の前提）。エアギャップ環境での閲覧環境は要件定義とは別に確認が必要
- **意図的に使っていない機能**（2026-08-05に検討して見送った）: コンテナクエリ（`@container`）、`mask-*`、`text-shadow-*`、3D transform。理由: (1) 現状のレイアウトは全部flexboxの`flex-wrap`で自然にコンテナ幅対応できており、コンテナクエリを足しても挙動が変わらない（同じ幅で違うレイアウトに切り替えたい場面がまだ無い）。(2) `mask-*`によるスクロール端のフェードは、コンテンツがあふれていない時にも一律で最後の要素を薄く欠けさせてしまい、正しくスクロール可能なことを示すどころか壊れて見えるリスクがある（JSでの実際のoverflow検知と組み合わせない限り採用しない）。(3) `text-shadow`は、primary-foregroundの明暗をテーマごとに計算してコントラストを保証済みなので機能的な必要性が無く、要件定義12章「色は装飾ではなく状態表現のためだけに使う」の原則にも反する。(4) 3D transformはこのツールの実務的なUIに合う使いどころが無い。どれも「新しいから使う」ではなく、必要になった時に個別に検討すること

## 8. Cloudflare Workers ローカル開発（今は未使用、将来D1に繋ぐとき用）

現状 `adapter-auto` のままで `wrangler.jsonc` も無い。D1を実際に試す際の手順：

1. `bun add -D @sveltejs/adapter-cloudflare` → `vite.config.ts`のadapterを差し替え
2. `wrangler d1 create <name>` → `wrangler.jsonc`に`d1_databases`バインディング（`binding: "DB"`）を追加
3. そのまま `bun run dev` でよい。**`@cloudflare/vite-plugin`は不要**——`adapter-cloudflare`が内部で`getPlatformProxy()`を使い、`wrangler.jsonc`のbindingsからローカルD1（Miniflare）を自動エミュレートして`platform.env`に注入してくれる（SvelteKit公式ドキュメント「Testing locally」節）
4. 本番の`workerd`ランタイムそのもので最終確認したい場合だけ、ビルド後に`wrangler dev .svelte-kit/cloudflare/_worker.js`

`src/lib/server/db/index.ts`の`getDb(platform)`は既にこの分岐（`platform?.env?.DB`の有無）を前提に書いてあるので、上記を行えばコード変更なしでD1に切り替わる**はず**——ただし`db/bootstrap.ts`のSQLiteトリガー（event追記専用の強制）はD1では未対応（design.md 9章 未決定事項）。

## 9. ディレクトリ構成（実装済み部分）

```text
src/
  routes/                              … Presentation層
    +layout.svelte / +layout.server.ts  … ヘッダー・ThemeSwitcher・RelayConnectionBadge・currentPerson
    api/theme/+server.ts                 … テーマCookie保存
    api/relay/                           … register/heartbeat/jobs（今すぐ取得）/deliver
    dev-login/                           … 開発用ログインスタブ
    relay/+page.svelte                   … Relay初回フォルダ選択・状態詳細（design.md 9.6節）
    [titleId]/
      +page.svelte                       … Timeline一覧
      [timelineId]/+page.svelte          … Timeline Viewer（Cut帯＋共有リンク発行）
      members/+page.svelte               … メンバー管理（design.md 8.6節）
      settings/+page.svelte              … 作品設定（Relay転送待ちストレージ設定含む）
    s/[token]/+page.svelte               … Magic Identity着地ページ
  lib/
    theme.ts                             … テーマ定義の単一情報源
    client/relay-connection.svelte.ts    … Relay接続状態の共有state（Svelte 5 module runes）
    components/ThemeSwitcher.svelte
    components/RelayConnectionBadge.svelte
    core/                                … Functional Core（純粋関数、*.spec.ts併設）
      timeline.ts / membership.ts / share-link.ts / event-hash.ts / relay.ts
      projections/timeline-band-view.ts / membership-state.ts
    server/
      db/schema.ts, index.ts, bootstrap.ts
      auth/internal.ts（開発用スタブ）, share-token.ts（Magic Identity）
      shell/
        relay-object-storage.ts … aws4fetchによるS3互換API直叩き（design.md 9.6.2節）
        repository/  … Drizzleクエリ（timeline/person/membership/share-link/event/relay）
        commands/    … decide呼び出し＋event追記＋投影更新
        queries/     … 投影テーブル読み出し
        authorization.ts
scripts/
  apply-migrations.ts   … db:apply の実体（bun:sqliteで直接SQL適用）
  seed.ts                … デモデータ投入
```
