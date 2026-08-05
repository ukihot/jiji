import { describe, expect, it } from 'vitest';
import {
	SHARE_LINK_MAX_DURATION_MS,
	decideShareLink,
	evolveShareLink,
	isShareLinkActive,
	type ShareLinkContext,
	type ShareLinkEvent,
} from './share-link';

const now = new Date('2026-08-05T00:00:00.000Z');
const activeContext: ShareLinkContext = {
	now,
	isActive: true,
	alreadyClaimedPersonId: null,
	alreadyRevoked: false,
};

describe('decideShareLink: CreateShareLink', () => {
	it('rejects a link with no target cuts', () => {
		const result = decideShareLink(
			{
				type: 'CreateShareLink',
				shareLinkId: 's1',
				targetCutIds: [],
				permissionLevel: 'contributor',
				createdBy: 'admin1',
				expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
			},
			activeContext,
		);
		expect(result.ok).toBe(false);
	});

	it('rejects an expiry in the past', () => {
		const result = decideShareLink(
			{
				type: 'CreateShareLink',
				shareLinkId: 's1',
				targetCutIds: ['c1'],
				permissionLevel: 'viewer',
				createdBy: 'admin1',
				expiresAt: new Date(now.getTime() - 1000),
			},
			activeContext,
		);
		expect(result.ok).toBe(false);
	});

	it('rejects an expiry beyond the 90-day maximum', () => {
		const result = decideShareLink(
			{
				type: 'CreateShareLink',
				shareLinkId: 's1',
				targetCutIds: ['c1'],
				permissionLevel: 'viewer',
				createdBy: 'admin1',
				expiresAt: new Date(now.getTime() + SHARE_LINK_MAX_DURATION_MS + 1000),
			},
			activeContext,
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.kind).toBe('expiry_too_far');
	});

	it('accepts a valid 7-day (default) link', () => {
		const result = decideShareLink(
			{
				type: 'CreateShareLink',
				shareLinkId: 's1',
				targetCutIds: ['c1', 'c2'],
				permissionLevel: 'contributor',
				createdBy: 'admin1',
				expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
			},
			activeContext,
		);
		expect(result.ok).toBe(true);
	});
});

describe('decideShareLink: ClaimShareLink (Magic Identity)', () => {
	it('rejects claiming an inactive (expired/revoked) link', () => {
		const result = decideShareLink(
			{ type: 'ClaimShareLink', shareLinkId: 's1', personId: 'p1', name: '佐藤' },
			{ ...activeContext, isActive: false },
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.kind).toBe('link_inactive');
	});

	it('rejects re-claiming an already-claimed link (同一トークン＝同一人物)', () => {
		const result = decideShareLink(
			{ type: 'ClaimShareLink', shareLinkId: 's1', personId: 'p2', name: '鈴木' },
			{ ...activeContext, alreadyClaimedPersonId: 'p1' },
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.kind).toBe('already_claimed');
	});

	it('rejects a blank name', () => {
		const result = decideShareLink(
			{ type: 'ClaimShareLink', shareLinkId: 's1', personId: 'p1', name: '  ' },
			activeContext,
		);
		expect(result.ok).toBe(false);
	});

	it('accepts a valid claim', () => {
		const result = decideShareLink(
			{ type: 'ClaimShareLink', shareLinkId: 's1', personId: 'p1', name: '佐藤' },
			activeContext,
		);
		expect(result.ok).toBe(true);
	});
});

describe('decideShareLink: RevokeShareLink', () => {
	it('rejects revoking an already-revoked link', () => {
		const result = decideShareLink(
			{ type: 'RevokeShareLink', shareLinkId: 's1', revokedBy: 'admin1' },
			{ ...activeContext, alreadyRevoked: true },
		);
		expect(result.ok).toBe(false);
	});

	it('accepts revoking an active link', () => {
		const result = decideShareLink(
			{ type: 'RevokeShareLink', shareLinkId: 's1', revokedBy: 'admin1' },
			activeContext,
		);
		expect(result.ok).toBe(true);
	});
});

describe('evolveShareLink', () => {
	it('folds Created → Claimed → Revoked into the final state', () => {
		const events: ShareLinkEvent[] = [
			{
				type: 'ShareLinkCreated',
				payload: {
					shareLinkId: 's1',
					targetCutIds: ['c1'],
					permissionLevel: 'contributor',
					createdBy: 'admin1',
					createdAt: now.toISOString(),
					expiresAt: new Date(now.getTime() + 1000).toISOString(),
				},
			},
			{
				type: 'ShareLinkClaimed',
				payload: { shareLinkId: 's1', personId: 'p1', name: '佐藤', claimedAt: now.toISOString() },
			},
			{
				type: 'ShareLinkRevoked',
				payload: { shareLinkId: 's1', revokedBy: 'admin1', revokedAt: now.toISOString() },
			},
		];
		expect(evolveShareLink(events)).toEqual({ claimedPersonId: 'p1', revoked: true });
	});
});

describe('isShareLinkActive', () => {
	it('is active before expiry and not revoked', () => {
		expect(
			isShareLinkActive({ expiresAt: new Date(now.getTime() + 1000), revokedAt: null }, now),
		).toBe(true);
	});

	it('is inactive after expiry', () => {
		expect(
			isShareLinkActive({ expiresAt: new Date(now.getTime() - 1000), revokedAt: null }, now),
		).toBe(false);
	});

	it('is inactive once revoked, even before expiry', () => {
		expect(
			isShareLinkActive({ expiresAt: new Date(now.getTime() + 1000), revokedAt: now }, now),
		).toBe(false);
	});
});
