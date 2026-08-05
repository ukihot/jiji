import { describe, expect, it } from 'vitest';
import {
	decideRepresentation,
	evolveRepresentation,
	type CutProductionState,
	type RepresentationContext,
	type RepresentationEvent,
} from './representation';

const now = new Date('2026-08-06T00:00:00.000Z');
const baseContext: RepresentationContext = { now };
const emptyState: CutProductionState = {
	representationsByType: new Map(),
	knownVersionIds: new Set(),
};

describe('decideRepresentation: SubmitVersion', () => {
	it('rejects a blank file_ref', () => {
		const result = decideRepresentation(
			{
				type: 'SubmitVersion',
				cutId: 'c1',
				representationType: 'layout',
				representationIdIfNew: 'r1',
				submissionId: 's1',
				versionId: 'v1',
				processStep: 'LO',
				fileRef: '   ',
				proxyRef: null,
				artifactMetadata: null,
				derivedFrom: null,
				submittedBy: 'p1',
			},
			emptyState,
			baseContext,
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.kind).toBe('blank_file_ref');
	});

	it('creates the Representation and its first Version when none exists yet', () => {
		const result = decideRepresentation(
			{
				type: 'SubmitVersion',
				cutId: 'c1',
				representationType: 'layout',
				representationIdIfNew: 'r1',
				submissionId: 's1',
				versionId: 'v1',
				processStep: 'LO',
				fileRef: '//nas/c1/layout/v1.psd',
				proxyRef: null,
				artifactMetadata: null,
				derivedFrom: null,
				submittedBy: 'p1',
			},
			emptyState,
			baseContext,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.events.map((e) => e.type)).toEqual(['RepresentationCreated', 'VersionSubmitted']);
		expect(result.events[0]).toMatchObject({
			payload: { representationId: 'r1', representationType: 'layout', sortOrder: 2 },
		});
		expect(result.events[1]).toMatchObject({ payload: { seq: 1, representationId: 'r1' } });
	});

	it('reuses the existing Representation and increments seq for a second submission of the same type', () => {
		const state: CutProductionState = {
			representationsByType: new Map([
				[
					'layout',
					{
						representationId: 'r1',
						representationType: 'layout',
						sortOrder: 2,
						versionCount: 1,
						latestVersionId: 'v1',
					},
				],
			]),
			knownVersionIds: new Set(['v1']),
		};
		const result = decideRepresentation(
			{
				type: 'SubmitVersion',
				cutId: 'c1',
				representationType: 'layout',
				representationIdIfNew: 'r-unused',
				submissionId: 's2',
				versionId: 'v2',
				processStep: 'LO修正',
				fileRef: '//nas/c1/layout/v2.psd',
				proxyRef: null,
				artifactMetadata: null,
				derivedFrom: null,
				submittedBy: 'p1',
			},
			state,
			baseContext,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		// 既存Representationを再利用するのでRepresentationCreatedは出ない
		expect(result.events.map((e) => e.type)).toEqual(['VersionSubmitted']);
		expect(result.events[0]).toMatchObject({ payload: { representationId: 'r1', seq: 2 } });
	});

	it('gives an independent seq space to a different representation type on the same cut', () => {
		const state: CutProductionState = {
			representationsByType: new Map([
				[
					'layout',
					{
						representationId: 'r1',
						representationType: 'layout',
						sortOrder: 2,
						versionCount: 3,
						latestVersionId: 'v3',
					},
				],
			]),
			knownVersionIds: new Set(['v1', 'v2', 'v3']),
		};
		const result = decideRepresentation(
			{
				type: 'SubmitVersion',
				cutId: 'c1',
				representationType: 'animation',
				representationIdIfNew: 'r2',
				submissionId: 's4',
				versionId: 'v4',
				processStep: '一原',
				fileRef: '//nas/c1/animation/v1.psd',
				proxyRef: null,
				artifactMetadata: null,
				derivedFrom: null,
				submittedBy: 'p1',
			},
			state,
			baseContext,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.events.map((e) => e.type)).toEqual(['RepresentationCreated', 'VersionSubmitted']);
		expect(result.events[1]).toMatchObject({ payload: { representationId: 'r2', seq: 1 } });
	});

	it('accepts a derivedFrom pointing at a known version, across representations', () => {
		const state: CutProductionState = {
			representationsByType: new Map([
				[
					'layout',
					{
						representationId: 'r1',
						representationType: 'layout',
						sortOrder: 2,
						versionCount: 1,
						latestVersionId: 'v1',
					},
				],
			]),
			knownVersionIds: new Set(['v1']),
		};
		const result = decideRepresentation(
			{
				type: 'SubmitVersion',
				cutId: 'c1',
				representationType: 'animation',
				representationIdIfNew: 'r2',
				submissionId: 's2',
				versionId: 'v2',
				processStep: '一原',
				fileRef: '//nas/c1/animation/v1.psd',
				proxyRef: null,
				artifactMetadata: null,
				derivedFrom: { versionId: 'v1', relation: 'refined' },
				submittedBy: 'p1',
			},
			state,
			baseContext,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const versionSubmitted = result.events.find((e) => e.type === 'VersionSubmitted');
		expect(versionSubmitted).toMatchObject({
			payload: { derivedFrom: { versionId: 'v1', relation: 'refined' } },
		});
	});

	it('rejects a derivedFrom pointing at an unknown version', () => {
		const result = decideRepresentation(
			{
				type: 'SubmitVersion',
				cutId: 'c1',
				representationType: 'animation',
				representationIdIfNew: 'r1',
				submissionId: 's1',
				versionId: 'v1',
				processStep: '一原',
				fileRef: '//nas/c1/animation/v1.psd',
				proxyRef: null,
				artifactMetadata: null,
				derivedFrom: { versionId: 'v-unknown', relation: 'refined' },
				submittedBy: 'p1',
			},
			emptyState,
			baseContext,
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.kind).toBe('derived_from_version_not_found');
	});
});

describe('decideRepresentation: SubmitReview', () => {
	const stateWithVersion: CutProductionState = {
		representationsByType: new Map(),
		knownVersionIds: new Set(['v1']),
	};

	it('rejects a review of an unknown version', () => {
		const result = decideRepresentation(
			{
				type: 'SubmitReview',
				reviewId: 'rv1',
				versionId: 'v-unknown',
				reviewerId: 'p2',
				result: 'approved',
				comment: null,
			},
			emptyState,
			baseContext,
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.kind).toBe('version_not_found');
	});

	it('accepts an approving review of a known version', () => {
		const result = decideRepresentation(
			{
				type: 'SubmitReview',
				reviewId: 'rv1',
				versionId: 'v1',
				reviewerId: 'p2',
				result: 'approved',
				comment: 'いいですね',
			},
			stateWithVersion,
			baseContext,
		);
		expect(result.ok).toBe(true);
	});

	it('accepts a returning review of a known version', () => {
		const result = decideRepresentation(
			{
				type: 'SubmitReview',
				reviewId: 'rv2',
				versionId: 'v1',
				reviewerId: 'p2',
				result: 'returned',
				comment: '線が硬いので修正',
			},
			stateWithVersion,
			baseContext,
		);
		expect(result.ok).toBe(true);
	});
});

describe('decideRepresentation: SealVersion', () => {
	const stateWithVersion: CutProductionState = {
		representationsByType: new Map(),
		knownVersionIds: new Set(['v1']),
	};

	it('rejects sealing an unknown version', () => {
		const result = decideRepresentation(
			{
				type: 'SealVersion',
				sealId: 'seal1',
				versionId: 'v-unknown',
				representationId: 'r1',
				hash: 'deadbeef',
				sealedBy: 'admin1',
			},
			emptyState,
			baseContext,
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.kind).toBe('version_not_found');
	});

	it('accepts sealing a known version, independent of any review', () => {
		const result = decideRepresentation(
			{
				type: 'SealVersion',
				sealId: 'seal1',
				versionId: 'v1',
				representationId: 'r1',
				hash: 'deadbeef',
				sealedBy: 'admin1',
			},
			stateWithVersion,
			baseContext,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.events).toEqual([
			{
				type: 'VersionSealed',
				payload: {
					sealId: 'seal1',
					versionId: 'v1',
					representationId: 'r1',
					hash: 'deadbeef',
					sealedBy: 'admin1',
					sealedAt: now.toISOString(),
				},
			},
		]);
	});
});

describe('evolveRepresentation', () => {
	it('folds RepresentationCreated + VersionSubmitted into versionCount/latestVersionId', () => {
		const events: RepresentationEvent[] = [
			{
				type: 'RepresentationCreated',
				payload: {
					representationId: 'r1',
					cutId: 'c1',
					representationType: 'layout',
					sortOrder: 2,
				},
			},
			{
				type: 'VersionSubmitted',
				payload: {
					representationId: 'r1',
					representationType: 'layout',
					cutId: 'c1',
					submissionId: 's1',
					versionId: 'v1',
					seq: 1,
					processStep: 'LO',
					fileRef: 'f1',
					proxyRef: null,
					artifactMetadata: null,
					derivedFrom: null,
					submittedBy: 'p1',
					submittedAt: now.toISOString(),
				},
			},
			{
				type: 'VersionSubmitted',
				payload: {
					representationId: 'r1',
					representationType: 'layout',
					cutId: 'c1',
					submissionId: 's2',
					versionId: 'v2',
					seq: 2,
					processStep: 'LO修正',
					fileRef: 'f2',
					proxyRef: null,
					artifactMetadata: null,
					derivedFrom: null,
					submittedBy: 'p1',
					submittedAt: now.toISOString(),
				},
			},
		];
		const state = evolveRepresentation(events);
		const layout = state.representationsByType.get('layout');
		expect(layout?.versionCount).toBe(2);
		expect(layout?.latestVersionId).toBe('v2');
		expect(state.knownVersionIds.has('v1')).toBe(true);
		expect(state.knownVersionIds.has('v2')).toBe(true);
	});

	it('leaves representation bookkeeping untouched by ReviewSubmitted and VersionSealed', () => {
		const events: RepresentationEvent[] = [
			{
				type: 'RepresentationCreated',
				payload: {
					representationId: 'r1',
					cutId: 'c1',
					representationType: 'layout',
					sortOrder: 2,
				},
			},
			{
				type: 'VersionSubmitted',
				payload: {
					representationId: 'r1',
					representationType: 'layout',
					cutId: 'c1',
					submissionId: 's1',
					versionId: 'v1',
					seq: 1,
					processStep: 'LO',
					fileRef: 'f1',
					proxyRef: null,
					artifactMetadata: null,
					derivedFrom: null,
					submittedBy: 'p1',
					submittedAt: now.toISOString(),
				},
			},
			{
				type: 'ReviewSubmitted',
				payload: {
					reviewId: 'rv1',
					versionId: 'v1',
					reviewerId: 'p2',
					result: 'returned',
					comment: null,
					reviewedAt: now.toISOString(),
				},
			},
			{
				type: 'VersionSealed',
				payload: {
					sealId: 'seal1',
					versionId: 'v1',
					representationId: 'r1',
					hash: 'deadbeef',
					sealedBy: 'admin1',
					sealedAt: now.toISOString(),
				},
			},
		];
		const state = evolveRepresentation(events);
		expect(state.representationsByType.get('layout')?.versionCount).toBe(1);
		expect(state.knownVersionIds.size).toBe(1);
	});
});
