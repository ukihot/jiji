import { describe, expect, it } from 'vitest';
import {
	decideRelayJobClaim,
	decideRelayDeliveryVerification,
	decideRelaySourceCleanup,
	deriveRelayStatus,
	deriveRelayTargetRelativePath,
	isSafeTargetRelativePath,
	validateRelayStorageConfig,
} from './relay';

const now = new Date('2026-08-19T00:02:00.000Z');

describe('deriveRelayStatus', () => {
	it('derives online, checking and offline from heartbeat age', () => {
		expect(
			deriveRelayStatus({
				lastHeartbeatAt: new Date('2026-08-19T00:01:20.000Z'),
				writable: true,
				now,
			}),
		).toBe('online');
		expect(
			deriveRelayStatus({
				lastHeartbeatAt: new Date('2026-08-19T00:00:30.000Z'),
				writable: true,
				now,
			}),
		).toBe('checking');
		expect(
			deriveRelayStatus({
				lastHeartbeatAt: new Date('2026-08-18T23:59:00.000Z'),
				writable: true,
				now,
			}),
		).toBe('offline');
	});
});

describe('Relay safety decisions', () => {
	it('rejects paths that escape the selected Directory Handle', () => {
		expect(isSafeTargetRelativePath('Episode-01/C-001/layout.psd')).toBe(true);
		expect(isSafeTargetRelativePath('../secret.psd')).toBe(false);
		expect(isSafeTargetRelativePath('Z:\\other\\secret.psd')).toBe(false);
	});

	it('only lets online relays claim pending or expired jobs', () => {
		expect(
			decideRelayJobClaim({ jobState: 'pending', leaseUntil: null, relayStatus: 'online', now }),
		).toEqual({ ok: true });
		expect(
			decideRelayJobClaim({
				jobState: 'leased',
				leaseUntil: new Date('2026-08-19T00:03:00Z'),
				relayStatus: 'online',
				now,
			}),
		).toEqual({ ok: false, reason: 'job_not_available' });
	});

	it('starts source cleanup only after every shared-folder delivery is hash-verified', () => {
		const verified = {
			state: 'delivered' as const,
			expectedSize: 12,
			expectedSha256: 'abc',
			deliveredSize: 12,
			deliveredSha256: 'ABC',
		};
		expect(
			decideRelaySourceCleanup({
				deliveries: [verified, { ...verified, state: 'pending' }],
				sourceDeleteState: 'pending',
			}),
		).toEqual({ action: 'wait_for_all_shared_folder_deliveries' });
		expect(
			decideRelaySourceCleanup({
				deliveries: [verified, verified],
				sourceDeleteState: 'pending',
			}),
		).toEqual({ action: 'delete_source_object' });
	});

	it('does not accept a shared-folder delivery with a mismatched hash', () => {
		expect(
			decideRelayDeliveryVerification({
				expectedSize: 12,
				expectedSha256: 'abc',
				actualSize: 12,
				actualSha256: 'def',
			}),
		).toEqual({ ok: false, reason: 'sha256_mismatch' });
	});

	it('accepts a delivery with no pre-known hash when the size matches', () => {
		expect(
			decideRelayDeliveryVerification({
				expectedSize: 12,
				expectedSha256: null,
				actualSize: 12,
				actualSha256: 'anything',
			}),
		).toEqual({ ok: true, nextState: 'delivered', nextSourceDeleteState: 'pending' });
	});

	it('derives the relay-relative path from an object key under prefix', () => {
		expect(deriveRelayTargetRelativePath('jiji-relay/Episode-01/C-001.psd', 'jiji-relay')).toBe(
			'Episode-01/C-001.psd',
		);
		expect(deriveRelayTargetRelativePath('other/secret.psd', 'jiji-relay')).toBeNull();
		expect(deriveRelayTargetRelativePath('jiji-relay/folder/', 'jiji-relay')).toBeNull();
		expect(deriveRelayTargetRelativePath('root.psd', '')).toBe('root.psd');
	});

	it('requires an endpoint for arbitrary S3-compatible storage', () => {
		expect(
			validateRelayStorageConfig({
				provider: 's3_compatible',
				endpoint: null,
				bucketOrContainer: 'production',
				prefix: 'jiji-relay',
				authRef: 'RELAY_STORAGE_SECRET',
			}),
		).toBe('endpoint_required');
	});
});
