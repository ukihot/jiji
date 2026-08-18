# Jiji

**絵コンテから完パケまで、1本のタイムラインが更新され続ける** 国産TVアニメ制作向けの作品管理ツール（Living Timeline）。

コアコンセプトや設計原則は [doc/requirements.md](doc/requirements.md)、技術的な設計判断は [doc/design.md](doc/design.md) を参照してください。開発時に実際に手を動かす手順やこの環境固有の注意点は [CLAUDE.md](CLAUDE.md) にまとまっています。

## 開発環境のセットアップ

```bash
bun install
bun run db:generate   # スキーマからSQLマイグレーションを生成
bun run db:apply      # ローカルSQLite（./local.db）に適用
bun run db:seed       # デモデータ投入（作品・話数・カット・メンバー・共有リンク）
bun run dev           # http://localhost:5173
```

より詳しいコマンド・アーキテクチャ・既知の環境問題は [CLAUDE.md](CLAUDE.md) を参照してください。

## 翻訳への貢献（Contributing Translations）

Jijiの多言語対応には [inlang](https://inlang.com) / [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) を使っています。コードを読まなくても、翻訳ファイルを直接編集するだけで貢献できます。

### 仕組み

- 表示文言は `messages/{locale}.json` に集約されています（コード側にベタ書きの文言はありません）
- 現在対応しているロケール: `ja`（基準ロケール） / `en`
- 設定は [project.inlang/settings.json](project.inlang/settings.json) に、UIコード側からの参照は `import * as m from '$lib/paraglide/messages'` → `m.your_message_id()` という形で行っています

### 既存の翻訳を直す・追加する

1. `messages/en.json`（対象ロケールのファイル）を開く
2. `messages/ja.json`（基準ロケール、常に最新のキー一覧）と見比べて、足りないキーやおかしい訳文を直す
3. `bun run dev` を起動すれば自動でコンパイルされ、その場で反映を確認できます

キーはパラメータ付きのものがあります（例: `"episode_label": "{season} 第{episode}話"`）。`{}` で囲われた部分は変数なので、訳文中に同じ名前でそのまま残してください。

### 新しいロケールを追加する

1. [project.inlang/settings.json](project.inlang/settings.json) の `locales` 配列にロケールコードを追加する
2. `messages/ja.json` をコピーして `messages/<locale>.json` を作り、値だけを訳す（キーは変えない）
3. `bun install` 済みなら `bunx @inlang/paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide` で一度コンパイルを確認する（`bun run dev`/`bun run build` でも自動的にコンパイルされます）

### コードを書かずに翻訳したい場合

JSONを直接編集する代わりに、inlangが提供するツールも使えます。

- [Sherlock](https://inlang.com/m/r7kp499g/app-inlang-ide-extension)（VS Code拡張）: エディタ上で翻訳の抜け漏れをハイライトしてくれる
- [Fink](https://inlang.com/m/tdozzpar/app-inlang-finkLocalizationEditor)（Webの翻訳エディタ）: ブラウザだけでJSONファイルを編集・PR作成できる

### メッセージキーの命名ルール

新しい文言を追加するときは、既存の接頭辞に合わせてください（`messages/ja.json` を眺めると一覧できます）。

| 接頭辞 | 用途 | 例 |
| --- | --- | --- |
| `label_` | フォームのラベル・見出し語 | `label_expiry` |
| `action_` | ボタン・送信操作 | `action_create` |
| `error_` | フォームのバリデーション・失敗メッセージ | `error_login_required` |
| `nav_` | ナビゲーションリンク | `nav_back_home` |
| その他 | ページ・機能名を接頭辞にする | `devlogin_heading`, `sharelink_hint` |

翻訳だけのPRであれば `messages/*.json` 以外に変更は不要です。
