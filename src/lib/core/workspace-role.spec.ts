import { describe, expect, it } from 'vitest';
import { canWorkspaceRole, type WorkspaceCapability, type WorkspaceRole } from './workspace-role';

const capabilities: WorkspaceCapability[] = [
	'viewWorkspace',
	'submitProductionUpdate',
	'manageProduction',
	'auditLogs',
	'manageWorkspaceRoles',
];

describe('canWorkspaceRole', () => {
	it('allows every capability for an owner', () => {
		for (const capability of capabilities) expect(canWorkspaceRole('owner', capability)).toBe(true);
	});

	it('lets an admin manage production and audit, but not workspace roles', () => {
		expect(canWorkspaceRole('admin', 'manageProduction')).toBe(true);
		expect(canWorkspaceRole('admin', 'auditLogs')).toBe(true);
		expect(canWorkspaceRole('admin', 'manageWorkspaceRoles')).toBe(false);
	});

	it('limits members to viewing and production updates', () => {
		const allowed: WorkspaceCapability[] = ['viewWorkspace', 'submitProductionUpdate'];
		for (const capability of capabilities) {
			expect(canWorkspaceRole('member', capability)).toBe(allowed.includes(capability));
		}
	});

	it('does not grant workspace capabilities to participants', () => {
		for (const capability of capabilities) expect(canWorkspaceRole(null, capability)).toBe(false);
	});
});
