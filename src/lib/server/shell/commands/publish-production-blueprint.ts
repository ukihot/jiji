import {
	validateBlueprint,
	type BlueprintNode,
	type CapabilityKey,
	type ProductionBlueprintDefinition,
} from '$lib/core/production-kernel';
import type { RepresentationType } from '$lib/core/representation';
import type { SqliteDb } from '../../db';
import { appendEvent } from '../repository/event-repository';
import {
	getNextBlueprintVersion,
	getPublishedBlueprint,
	insertProcessEdges,
	insertProcessNodes,
	insertProductionBlueprint,
	insertReviewGates,
	retirePublishedBlueprints,
	replaceEnabledRepresentationTypes,
} from '../repository/production-repository';

const CAPABILITY_BY_REPRESENTATION: Record<RepresentationType, CapabilityKey> = {
	storyboard: 'storyboard',
	animatic: 'animatic',
	layout: 'layout',
	animation: 'animation',
	bg: 'background',
	cg_render: 'cg_render',
	composite: 'composite',
	final: 'final_delivery',
};

export type PublishBlueprintResult =
	| { ok: true; blueprintId: string; version: number }
	| { ok: false; errors: string[] };

/**
 * 既存のRepresentationチェック設定を、公開済み不変Blueprintへ昇格させる最小の導入経路。
 * 将来のAtelier Setupは同じコマンドへ任意のnode/edgeを渡すだけで拡張できる。
 */
export async function publishProductionBlueprint(
	db: SqliteDb,
	input: { titleId: string; enabledTypes: RepresentationType[]; publishedBy: string },
): Promise<PublishBlueprintResult> {
	const blueprintId = crypto.randomUUID();
	const nodeIds = new Map<RepresentationType, string>();
	const nodes: BlueprintNode[] = input.enabledTypes.map((type, sortHint) => {
		const id = crypto.randomUUID();
		nodeIds.set(type, id);
		return {
			id,
			capabilityKey: CAPABILITY_BY_REPRESENTATION[type],
			representationType: type,
			kind: 'deliverable',
			required: true,
			sortHint,
		};
	});
	const edges = input.enabledTypes.slice(1).flatMap((type, index) => {
		const fromNodeId = nodeIds.get(input.enabledTypes[index]);
		const toNodeId = nodeIds.get(type);
		return fromNodeId && toNodeId ? [{ fromNodeId, toNodeId, relation: 'requires' as const }] : [];
	});
	const definition: ProductionBlueprintDefinition = { nodes, edges };
	const validationErrors = validateBlueprint(definition);
	if (validationErrors.length > 0) return { ok: false, errors: validationErrors };

	const now = new Date();
	return db.transaction(async (tx): Promise<PublishBlueprintResult> => {
		const [version, previous] = await Promise.all([
			getNextBlueprintVersion(tx, input.titleId),
			getPublishedBlueprint(tx, input.titleId),
		]);
		const event = await appendEvent(
			tx,
			'title',
			input.titleId,
			{
				type: 'ProductionBlueprintPublished',
				payload: {
					blueprintId,
					version,
					nodes: definition.nodes,
					edges: definition.edges,
					publishedBy: input.publishedBy,
				},
			},
			now,
		);
		await retirePublishedBlueprints(tx, input.titleId);
		await insertProductionBlueprint(tx, {
			id: blueprintId,
			titleId: input.titleId,
			version,
			status: 'published',
			basedOnBlueprintId: previous?.id ?? null,
			publishedAt: now,
			createdAt: now,
		});
		await insertProcessNodes(tx, blueprintId, nodes);
		await insertProcessEdges(
			tx,
			blueprintId,
			edges.map((edge) => ({ ...edge, id: crypto.randomUUID() })),
		);
		await insertReviewGates(
			tx,
			nodes.map((node) => ({
				id: crypto.randomUUID(),
				processNodeId: node.id,
				gateKey: `${node.capabilityKey}.review`,
				reviewerPolicy: ['admin'],
				required: true,
			})),
		);
		// 既存の提出UIが参照する互換投影も、同じ公開トランザクションで更新する。
		await replaceEnabledRepresentationTypes(tx, input.titleId, input.enabledTypes);

		return { ok: true, blueprintId, version };
	});
}
