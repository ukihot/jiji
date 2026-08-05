import { describe, expect, it } from 'vitest';
import { decideTimeline, evolveTimeline, type TimelineEvent } from './timeline';

describe('decideTimeline: CreateTitle', () => {
	it('rejects a blank name', () => {
		const result = decideTimeline(
			{ type: 'CreateTitle', titleId: 't1', name: '   ' },
			{ cutNumbers: new Set(), cutSortOrders: new Set() },
			{ titleExists: false }
		);
		expect(result.ok).toBe(false);
	});

	it('accepts a non-blank name', () => {
		const result = decideTimeline(
			{ type: 'CreateTitle', titleId: 't1', name: '〇〇' },
			{ cutNumbers: new Set(), cutSortOrders: new Set() },
			{ titleExists: false }
		);
		expect(result.ok).toBe(true);
	});
});

describe('decideTimeline: CreateTimeline', () => {
	it('rejects when the title does not exist', () => {
		const result = decideTimeline(
			{ type: 'CreateTimeline', timelineId: 'tl1', titleId: 't1', season: '1期', episode: 3 },
			{ cutNumbers: new Set(), cutSortOrders: new Set() },
			{ titleExists: false }
		);
		expect(result.ok).toBe(false);
	});

	it('rejects a non-positive episode number', () => {
		const result = decideTimeline(
			{ type: 'CreateTimeline', timelineId: 'tl1', titleId: 't1', season: '1期', episode: 0 },
			{ cutNumbers: new Set(), cutSortOrders: new Set() },
			{ titleExists: true }
		);
		expect(result.ok).toBe(false);
	});

	it('accepts a valid timeline', () => {
		const result = decideTimeline(
			{ type: 'CreateTimeline', timelineId: 'tl1', titleId: 't1', season: '1期', episode: 3 },
			{ cutNumbers: new Set(), cutSortOrders: new Set() },
			{ titleExists: true }
		);
		expect(result.ok).toBe(true);
	});
});

describe('decideTimeline: AddCut', () => {
	const state = { cutNumbers: new Set(['C-001']), cutSortOrders: new Set([0]) };

	it('rejects a duplicate cut number within the same timeline', () => {
		const result = decideTimeline(
			{
				type: 'AddCut',
				cutId: 'c2',
				timelineId: 'tl1',
				number: 'C-001',
				sortOrder: 1,
				plannedFrames: 24,
				sceneTags: []
			},
			state,
			{ titleExists: true }
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.kind).toBe('duplicate_cut_number');
	});

	it('rejects a duplicate sort_order within the same timeline', () => {
		const result = decideTimeline(
			{
				type: 'AddCut',
				cutId: 'c2',
				timelineId: 'tl1',
				number: 'C-002',
				sortOrder: 0,
				plannedFrames: 24,
				sceneTags: []
			},
			state,
			{ titleExists: true }
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.kind).toBe('duplicate_sort_order');
	});

	it('rejects non-positive planned_frames', () => {
		const result = decideTimeline(
			{
				type: 'AddCut',
				cutId: 'c2',
				timelineId: 'tl1',
				number: 'C-002',
				sortOrder: 1,
				plannedFrames: 0,
				sceneTags: []
			},
			state,
			{ titleExists: true }
		);
		expect(result.ok).toBe(false);
	});

	it('accepts a unique cut', () => {
		const result = decideTimeline(
			{
				type: 'AddCut',
				cutId: 'c2',
				timelineId: 'tl1',
				number: 'C-002',
				sortOrder: 1,
				plannedFrames: 24,
				sceneTags: ['夜']
			},
			state,
			{ titleExists: true }
		);
		expect(result.ok).toBe(true);
	});
});

describe('evolveTimeline', () => {
	it('folds CutAdded events into known cut numbers and sort orders', () => {
		const events: TimelineEvent[] = [
			{
				type: 'CutAdded',
				payload: {
					cutId: 'c1',
					timelineId: 'tl1',
					number: 'C-001',
					sortOrder: 0,
					plannedFrames: 24,
					sceneTags: []
				}
			},
			{
				type: 'CutAdded',
				payload: {
					cutId: 'c2',
					timelineId: 'tl1',
					number: 'C-002',
					sortOrder: 1,
					plannedFrames: 12,
					sceneTags: []
				}
			}
		];
		const state = evolveTimeline(events);
		expect(state.cutNumbers.has('C-001')).toBe(true);
		expect(state.cutNumbers.has('C-002')).toBe(true);
		expect(state.cutSortOrders.has(0)).toBe(true);
	});
});
