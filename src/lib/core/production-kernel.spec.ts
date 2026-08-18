import { describe, expect, it } from 'vitest';
import {
	deriveReadiness,
	explainReadiness,
	projectReadinessFrontier,
	projectRipple,
	projectStructureMap,
	severityForEdge,
	transitiveReduceRequires,
	validateBlueprint,
	type ProductionBlueprintDefinition,
} from './production-kernel';

const blueprint: ProductionBlueprintDefinition = {
	nodes: [
		{
			id: 'layout',
			capabilityKey: 'layout',
			representationType: 'layout',
			kind: 'deliverable',
			required: true,
			sortHint: 1,
		},
		{
			id: 'animation',
			capabilityKey: 'animation',
			representationType: 'animation',
			kind: 'deliverable',
			required: true,
			sortHint: 2,
		},
	],
	edges: [{ fromNodeId: 'layout', toNodeId: 'animation', relation: 'requires' }],
};

describe('production kernel', () => {
	it('accepts a bounded acyclic blueprint', () => {
		expect(validateBlueprint(blueprint)).toEqual([]);
	});

	it('rejects cyclic required dependencies', () => {
		expect(
			validateBlueprint({
				...blueprint,
				edges: [
					...blueprint.edges,
					{ fromNodeId: 'animation', toNodeId: 'layout', relation: 'requires' },
				],
			}),
		).toContain('edge_cycle');
	});

	it('derives stale work before accepting new work', () => {
		expect(
			deriveReadiness(
				{
					nodeId: 'layout',
					hasLatestVersion: true,
					hasCurrentGateEvidence: false,
					hasStaleGateEvidence: true,
					waivedUntil: null,
					artistAssigned: true,
					blockedByRequiredDependency: false,
				},
				new Date('2026-08-18T00:00:00Z'),
			),
		).toBe('stale');
	});

	it('does not turn a reference edge into a deadline block', () => {
		expect(
			severityForEdge('informs', { sourceWasGateEvidence: false, sourceIsMissing: true }),
		).toBe('info');
	});

	it('hides only transitive required edges in the Structure Map', () => {
		const triangle: ProductionBlueprintDefinition = {
			nodes: [
				...blueprint.nodes,
				{
					id: 'composite',
					capabilityKey: 'composite',
					representationType: 'composite',
					kind: 'deliverable',
					required: true,
					sortHint: 3,
				},
			],
			edges: [
				...blueprint.edges,
				{ fromNodeId: 'animation', toNodeId: 'composite', relation: 'requires' },
				{ fromNodeId: 'layout', toNodeId: 'composite', relation: 'requires' },
				{ fromNodeId: 'layout', toNodeId: 'composite', relation: 'informs' },
			],
		};
		expect(transitiveReduceRequires(triangle)).toEqual([
			{ fromNodeId: 'layout', toNodeId: 'animation', relation: 'requires' },
			{ fromNodeId: 'animation', toNodeId: 'composite', relation: 'requires' },
			{ fromNodeId: 'layout', toNodeId: 'composite', relation: 'informs' },
		]);
		expect(projectStructureMap(triangle).nodes.find((node) => node.id === 'composite')?.layer).toBe(
			2,
		);
	});

	it('keeps feasibility and displayable reasons separate from priority', () => {
		const readiness = new Map([
			['layout', 'passed' as const],
			['animation', 'ready' as const],
		]);
		expect(projectReadinessFrontier(blueprint.nodes, readiness).map((node) => node.id)).toEqual([
			'animation',
		]);
		expect(
			explainReadiness(
				{
					nodeId: 'animation',
					hasLatestVersion: false,
					hasCurrentGateEvidence: false,
					hasStaleGateEvidence: false,
					waivedUntil: null,
					artistAssigned: false,
					blockedByRequiredDependency: false,
				},
				new Date('2026-08-18T00:00:00Z'),
			),
		).toBe('artist_missing');
	});

	it('projects a local Ripple with an explanation path and typed severity', () => {
		const impacts = projectRipple(blueprint, 'layout', {
			sourceWasGateEvidence: true,
			sourceIsMissing: true,
		});
		expect(impacts).toEqual([
			{
				nodeId: 'animation',
				distance: 1,
				severity: 'blocked',
				path: ['layout', 'animation'],
			},
		]);
	});
});
