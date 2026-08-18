/** ワークスペース全体に適用される内部ユーザーの役割。共有URL参加者はnullで表す。 */
export const WORKSPACE_ROLES = ['owner', 'admin', 'member'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/** ルートやUIが直接ロール名を比較しないための、業務上の操作単位。 */
export type WorkspaceCapability =
	| 'viewWorkspace'
	| 'submitProductionUpdate'
	| 'manageProduction'
	| 'auditLogs'
	| 'manageWorkspaceRoles';

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
	return typeof value === 'string' && (WORKSPACE_ROLES as readonly string[]).includes(value);
}

/** FC: ロールと操作の対応表。I/Oやフレームワークに依存しない認可の正本。 */
export function canWorkspaceRole(
	role: WorkspaceRole | null | undefined,
	capability: WorkspaceCapability,
): boolean {
	if (role === 'owner') return true;
	if (role === 'admin') return capability !== 'manageWorkspaceRoles';
	if (role === 'member') {
		return capability === 'viewWorkspace' || capability === 'submitProductionUpdate';
	}
	return false;
}
