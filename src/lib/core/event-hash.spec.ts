import { describe, expect, it } from 'vitest';
import { canonicalJson, computeEventHash } from './event-hash';

describe('canonicalJson', () => {
	it('produces the same string regardless of key order', () => {
		expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
	});

	it('produces different strings for different content', () => {
		expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 2 }));
	});
});

describe('computeEventHash', () => {
	const createdAt = new Date('2026-08-05T00:00:00.000Z');

	it('is deterministic for the same input', () => {
		const a = computeEventHash(null, { type: 'CutAdded', payload: { number: 'C-001' }, createdAt });
		const b = computeEventHash(null, { type: 'CutAdded', payload: { number: 'C-001' }, createdAt });
		expect(a).toBe(b);
	});

	it('changes when the payload changes (tamper detection)', () => {
		const original = computeEventHash(null, {
			type: 'CutAdded',
			payload: { number: 'C-001' },
			createdAt,
		});
		const tampered = computeEventHash(null, {
			type: 'CutAdded',
			payload: { number: 'C-002' },
			createdAt,
		});
		expect(original).not.toBe(tampered);
	});

	it('chains: the same payload produces a different hash under a different prevHash', () => {
		const genesis = computeEventHash(null, { type: 'CutAdded', payload: { n: 1 }, createdAt });
		const chained = computeEventHash('some-prev-hash', {
			type: 'CutAdded',
			payload: { n: 1 },
			createdAt,
		});
		expect(genesis).not.toBe(chained);
	});
});
