/**
 * design.md 全体の動作確認用シードデータ投入スクリプト。
 *
 * 実行順序:
 *   bun run db:generate  （スキーマからSQLマイグレーションを生成）
 *   bun run db:apply     （ローカルSQLiteに適用。db:pushはこの環境ではネイティブ
 *                          モジュールがsegfaultするため使えない。db/apply-migrations参照）
 *   bun run db:seed      （このスクリプト）
 *   bun run dev
 *
 * ここではShellのcommand関数（実アプリと同じ書き込み経路）を直接呼ぶ。
 * こうすることで、イベント追記・投影更新・「Title作成者への自動admin付与」
 * （design.md 8.3節）などの本物のロジックを通った状態でデータが作られる。
 */
import { getDb } from '../src/lib/server/db';
import { addCut } from '../src/lib/server/shell/commands/add-cut';
import { createPerson } from '../src/lib/server/shell/commands/create-person';
import { createShareLink } from '../src/lib/server/shell/commands/create-share-link';
import { createTimeline } from '../src/lib/server/shell/commands/create-timeline';
import { createTitle } from '../src/lib/server/shell/commands/create-title';
import { grantMembership } from '../src/lib/server/shell/commands/grant-membership';

function must<T extends { ok: boolean }>(result: T, label: string): Extract<T, { ok: true }> {
	if (!result.ok) {
		console.error(`✗ ${label} に失敗しました:`, result);
		process.exit(1);
	}
	console.log(`✓ ${label}`);
	return result as Extract<T, { ok: true }>;
}

const db = await getDb();

// 制作進行（内部・このTitleのadminになる）
const producer = must(
	await createPerson(db, {
		name: '山田太郎',
		email: 'yamada@example.com',
		accountType: 'internal',
		workspaceRole: 'owner',
	}),
	'制作進行「山田太郎」を登録',
);

// 監督（内部・reviewer予定）
const director = must(
	await createPerson(db, {
		name: '鈴木花子',
		email: 'suzuki@example.com',
		accountType: 'internal',
		workspaceRole: 'member',
	}),
	'監督「鈴木花子」を登録',
);

// 単話だけ参加する外部の原画マン（メールなし。design.md 8.5.4節の「person + membership」パス）
const keyAnimator = must(
	await createPerson(db, { name: '佐藤次郎', email: null, accountType: 'external' }),
	'単話参加の原画「佐藤次郎」を登録',
);

// 作品。作成と同時に山田太郎が自動でこのTitleのadminになる（design.md 8.3節）
const title = must(
	await createTitle(db, { name: 'サンプル作品', createdBy: producer.personId }),
	'作品「サンプル作品」を作成（山田太郎が自動でadminに）',
);

must(
	await grantMembership(db, {
		personId: director.personId,
		scopeType: 'title',
		scopeId: title.titleId,
		permissionLevel: 'reviewer',
		processScope: null,
		grantedBy: producer.personId,
		expiresAt: null,
	}),
	'鈴木花子にreviewer権限を付与（作品全体・無期限）',
);

const timeline = must(
	await createTimeline(db, { titleId: title.titleId, season: '1期', episode: 3 }),
	'第3話のTimelineを作成',
);

// アニメ業界では1話だけ参加するスタッフが常態（design.md 8章）。
// 話数スコープ・期限付きでcontributor権限を与える。
const animatorExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
must(
	await grantMembership(db, {
		personId: keyAnimator.personId,
		scopeType: 'timeline',
		scopeId: timeline.timelineId,
		permissionLevel: 'contributor',
		processScope: ['作画'],
		grantedBy: producer.personId,
		expiresAt: animatorExpiresAt,
	}),
	`佐藤次郎に第3話だけcontributor権限を付与（期限: ${animatorExpiresAt.toLocaleDateString('ja-JP')}）`,
);

const cutSeeds = [
	{ number: 'C-001', sortOrder: 0, plannedFrames: 48, sceneTags: ['朝', '屋内'] },
	{ number: 'C-002', sortOrder: 1, plannedFrames: 72, sceneTags: ['朝', '屋内'] },
	{ number: 'C-003', sortOrder: 2, plannedFrames: 120, sceneTags: ['夜', '屋外'] },
];
const cutIds: string[] = [];
for (const cut of cutSeeds) {
	const result = must(
		await addCut(db, { timelineId: timeline.timelineId, ...cut }),
		`カット${cut.number}を追加（${cut.plannedFrames}コマ）`,
	);
	cutIds.push(result.cutId);
}

// 外部スタジオ向けの共有リンク（Magic Identityの動作確認用）
const shareLinkExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const shareLink = must(
	await createShareLink(db, {
		targetCutIds: cutIds.slice(0, 1),
		permissionLevel: 'contributor',
		createdBy: producer.personId,
		expiresAt: shareLinkExpiresAt,
	}),
	'外部スタジオ向け共有リンクを発行',
);

console.log('\n--- 完了 ---');
console.log('開発用ログイン（/dev-login）で「山田太郎」か「鈴木花子」を選んでください。');
console.log(`作品ページ: http://localhost:5173/${title.titleId}`);
console.log(`メンバー管理: http://localhost:5173/${title.titleId}/members`);
console.log(`Timeline: http://localhost:5173/${title.titleId}/${timeline.timelineId}`);
console.log(`\nMagic Identity確認用の共有リンク（この場でしか表示されません）:`);
console.log(`  http://localhost:5173/s/${shareLink.token}`);
