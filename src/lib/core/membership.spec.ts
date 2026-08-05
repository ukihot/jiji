import { describe, expect, it } from 'vitest';
import {
	decideMembership,
	evolveMembership,
	isMembershipActive,
	type MembershipContext,
	type MembershipEvent,
} from './membership';

const now = new Date('2026-08-05T00:00:00.000Z');

const baseContext: MembershipContext = {
	now,
	activeAdminCountExcludingTarget: 1,
	targetIsCurrentlyAdmin: false,
};

describe('decideMembership: GrantMembership', () => {
	it('allows a title-scoped internal grant with no expiry', () => {
		const result = decideMembership(
			{
				type: 'GrantMembership',
				membershipId: 'm1',
				personId: 'p1',
				personAccountType: 'internal',
				scopeType: 'title',
				scopeId: 't1',
				permissionLevel: 'reviewer',
				processScope: null,
				grantedBy: 'admin1',
				expiresAt: null,
			},
			baseContext,
		);
		expect(result.ok).toBe(true);
	});

	it('requires an expiry for timeline-scoped grants (1話だけ参加するスタッフ)', () => {
		const result = decideMembership(
			{
				type: 'GrantMembership',
				membershipId: 'm1',
				personId: 'p1',
				personAccountType: 'internal',
				scopeType: 'timeline',
				scopeId: 'tl1',
				permissionLevel: 'contributor',
				processScope: ['作画'],
				grantedBy: 'admin1',
				expiresAt: null,
			},
			baseContext,
		);
		expect(result.ok).toBe(false);
	});

	it('requires an expiry for external accounts even when scoped to a whole title', () => {
		const result = decideMembership(
			{
				type: 'GrantMembership',
				membershipId: 'm1',
				personId: 'p1',
				personAccountType: 'external',
				scopeType: 'title',
				scopeId: 't1',
				permissionLevel: 'viewer',
				processScope: null,
				grantedBy: 'admin1',
				expiresAt: null,
			},
			baseContext,
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.kind).toBe('expiry_required');
	});

	it('allows an external, timeline-scoped grant once an expiry is set', () => {
		const result = decideMembership(
			{
				type: 'GrantMembership',
				membershipId: 'm1',
				personId: 'p1',
				personAccountType: 'external',
				scopeType: 'timeline',
				scopeId: 'tl1',
				permissionLevel: 'contributor',
				processScope: ['作画'],
				grantedBy: 'admin1',
				expiresAt: new Date('2026-09-30T00:00:00.000Z'),
			},
			baseContext,
		);
		expect(result.ok).toBe(true);
	});
});

describe('decideMembership: last-admin lockout', () => {
	it('rejects downgrading the only remaining admin', () => {
		const result = decideMembership(
			{
				type: 'UpdateMembership',
				membershipId: 'm1',
				permissionLevel: 'reviewer',
				processScope: null,
			},
			{ now, activeAdminCountExcludingTarget: 0, targetIsCurrentlyAdmin: true },
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.kind).toBe('last_admin_lockout');
	});

	it('allows downgrading an admin when another admin remains', () => {
		const result = decideMembership(
			{
				type: 'UpdateMembership',
				membershipId: 'm1',
				permissionLevel: 'reviewer',
				processScope: null,
			},
			{ now, activeAdminCountExcludingTarget: 1, targetIsCurrentlyAdmin: true },
		);
		expect(result.ok).toBe(true);
	});

	it('rejects revoking the only remaining admin', () => {
		const result = decideMembership(
			{ type: 'RevokeMembership', membershipId: 'm1', revokedBy: 'admin2' },
			{ now, activeAdminCountExcludingTarget: 0, targetIsCurrentlyAdmin: true },
		);
		expect(result.ok).toBe(false);
	});

	it('allows revoking a non-admin regardless of admin count', () => {
		const result = decideMembership(
			{ type: 'RevokeMembership', membershipId: 'm1', revokedBy: 'admin2' },
			{ now, activeAdminCountExcludingTarget: 0, targetIsCurrentlyAdmin: false },
		);
		expect(result.ok).toBe(true);
	});
});

describe('evolveMembership', () => {
	it('folds Granted → Updated → Revoked into the final state', () => {
		const events: MembershipEvent[] = [
			{
				type: 'MembershipGranted',
				payload: {
					membershipId: 'm1',
					personId: 'p1',
					scopeType: 'title',
					scopeId: 't1',
					permissionLevel: 'contributor',
					processScope: null,
					grantedBy: 'admin1',
					grantedAt: now.toISOString(),
					expiresAt: null,
				},
			},
			{
				type: 'MembershipUpdated',
				payload: { membershipId: 'm1', permissionLevel: 'admin', processScope: null },
			},
			{
				type: 'MembershipRevoked',
				payload: { membershipId: 'm1', revokedBy: 'admin2', revokedAt: now.toISOString() },
			},
		];
		const state = evolveMembership(events);
		expect(state).toEqual({ permissionLevel: 'admin', revoked: true });
	});
});

describe('isMembershipActive', () => {
	it('is active when never revoked and no expiry', () => {
		expect(isMembershipActive({ expiresAt: null, revokedAt: null }, now)).toBe(true);
	});

	it('is inactive once revoked', () => {
		expect(isMembershipActive({ expiresAt: null, revokedAt: now }, now)).toBe(false);
	});

	it('is inactive once the expiry has passed', () => {
		const past = new Date(now.getTime() - 1000);
		expect(isMembershipActive({ expiresAt: past, revokedAt: null }, now)).toBe(false);
	});

	it('is active while the expiry is still in the future', () => {
		const future = new Date(now.getTime() + 1000);
		expect(isMembershipActive({ expiresAt: future, revokedAt: null }, now)).toBe(true);
	});
});
