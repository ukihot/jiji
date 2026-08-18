import type { RepresentationType } from './representation';

/** 作品固有の呼び方と分離する、横断検索・連携用の安定した工程意味。 */
export const CAPABILITY_KEYS = [
	'storyboard',
	'animatic',
	'layout',
	'animation',
	'background',
	'cg_layout',
	'cg_render',
	'look_development',
	'composite',
	'final_delivery',
] as const;

export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];
export type ProcessNodeKind = 'deliverable' | 'review' | 'milestone';
export type ProcessEdgeRelation = 'requires' | 'feeds' | 'informs';
export type ReadinessStatus =
	| 'not_ready'
	| 'ready'
	| 'awaiting_review'
	| 'passed'
	| 'stale'
	| 'waived';

export interface BlueprintNode {
	id: string;
	capabilityKey: CapabilityKey;
	representationType: RepresentationType | null;
	kind: ProcessNodeKind;
	required: boolean;
	sortHint: number;
}

export interface BlueprintEdge {
	fromNodeId: string;
	toNodeId: string;
	relation: ProcessEdgeRelation;
}

export interface ProductionBlueprintDefinition {
	nodes: BlueprintNode[];
	edges: BlueprintEdge[];
}

/**
 * Structure Mapの描画に使う、意味を持たない表示専用の階層。
 * `layer`は依存の深さであり、ノード座標や優先順位を正本にしない。
 */
export interface StructureMapProjection {
	nodes: Array<BlueprintNode & { layer: number }>;
	edges: BlueprintEdge[];
}

export type BlueprintValidationError =
	| 'blueprint_empty'
	| 'node_id_duplicate'
	| 'node_capability_invalid'
	| 'node_representation_missing'
	| 'edge_node_not_found'
	| 'edge_self_reference'
	| 'edge_duplicate'
	| 'edge_cycle';

export function isCapabilityKey(value: unknown): value is CapabilityKey {
	return typeof value === 'string' && (CAPABILITY_KEYS as readonly string[]).includes(value);
}

/**
 * 作品ごとの差異を受け止めつつ、循環依存・意味のない工程を公開前に排除する。
 * 入力を変えない純粋関数なので、Shellの公開コマンドと設定画面のdry runで共用する。
 */
export function validateBlueprint(
	definition: ProductionBlueprintDefinition,
): BlueprintValidationError[] {
	if (definition.nodes.length === 0) return ['blueprint_empty'];

	const errors: BlueprintValidationError[] = [];
	const nodeIds = new Set<string>();
	for (const node of definition.nodes) {
		if (nodeIds.has(node.id)) errors.push('node_id_duplicate');
		nodeIds.add(node.id);
		if (!isCapabilityKey(node.capabilityKey)) errors.push('node_capability_invalid');
		if (node.kind === 'deliverable' && node.representationType === null) {
			errors.push('node_representation_missing');
		}
	}

	const edgeKeys = new Set<string>();
	for (const edge of definition.edges) {
		if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) {
			errors.push('edge_node_not_found');
		}
		if (edge.fromNodeId === edge.toNodeId) errors.push('edge_self_reference');
		const key = `${edge.fromNodeId}:${edge.toNodeId}:${edge.relation}`;
		if (edgeKeys.has(key)) errors.push('edge_duplicate');
		edgeKeys.add(key);
	}

	const outgoing = new Map<string, string[]>();
	for (const edge of definition.edges) {
		if (edge.relation !== 'requires') continue;
		outgoing.set(edge.fromNodeId, [...(outgoing.get(edge.fromNodeId) ?? []), edge.toNodeId]);
	}
	const visiting = new Set<string>();
	const visited = new Set<string>();
	function visit(nodeId: string): boolean {
		if (visiting.has(nodeId)) return true;
		if (visited.has(nodeId)) return false;
		visiting.add(nodeId);
		const hasCycle = (outgoing.get(nodeId) ?? []).some(visit);
		visiting.delete(nodeId);
		visited.add(nodeId);
		return hasCycle;
	}
	if (definition.nodes.some((node) => visit(node.id))) errors.push('edge_cycle');

	return [...new Set(errors)];
}

export interface NodeEvidence {
	nodeId: string;
	hasLatestVersion: boolean;
	hasCurrentGateEvidence: boolean;
	hasStaleGateEvidence: boolean;
	waivedUntil: Date | null;
	artistAssigned: boolean;
	blockedByRequiredDependency: boolean;
}

/** 状態フラグを保存せず、版・ゲート・割当・前提から受け渡し可能性を導出する。 */
export function deriveReadiness(evidence: NodeEvidence, now: Date): ReadinessStatus {
	if (evidence.waivedUntil && evidence.waivedUntil > now) return 'waived';
	if (evidence.hasStaleGateEvidence) return 'stale';
	if (evidence.blockedByRequiredDependency || !evidence.artistAssigned) return 'not_ready';
	if (!evidence.hasLatestVersion) return 'ready';
	if (!evidence.hasCurrentGateEvidence) return 'awaiting_review';
	return 'passed';
}

export type ReadinessReasonCode =
	| 'waived'
	| 'stale_evidence'
	| 'blocked_dependency'
	| 'artist_missing'
	| 'version_missing'
	| 'gate_evidence_missing'
	| 'handoff_passed';

/** 表示層が説明文をローカライズできるよう、Readinessの決定理由を安定したコードで返す。 */
export function explainReadiness(evidence: NodeEvidence, now: Date): ReadinessReasonCode {
	if (evidence.waivedUntil && evidence.waivedUntil > now) return 'waived';
	if (evidence.hasStaleGateEvidence) return 'stale_evidence';
	if (evidence.blockedByRequiredDependency) return 'blocked_dependency';
	if (!evidence.artistAssigned) return 'artist_missing';
	if (!evidence.hasLatestVersion) return 'version_missing';
	if (!evidence.hasCurrentGateEvidence) return 'gate_evidence_missing';
	return 'handoff_passed';
}

/**
 * `requires`だけを対象にした表示用の推移的簡約。
 * 冗長辺を隠すだけで、正本のBlueprintや`feeds`/`informs`を変更しない。
 */
export function transitiveReduceRequires(
	definition: ProductionBlueprintDefinition,
): BlueprintEdge[] {
	const required = definition.edges.filter((edge) => edge.relation === 'requires');
	const nonRequired = definition.edges.filter((edge) => edge.relation !== 'requires');
	const reduced = required.filter((candidate) => {
		const outgoing = new Map<string, string[]>();
		for (const edge of required) {
			if (edge === candidate) continue;
			outgoing.set(edge.fromNodeId, [...(outgoing.get(edge.fromNodeId) ?? []), edge.toNodeId]);
		}
		const seen = new Set<string>([candidate.fromNodeId]);
		const queue = [...(outgoing.get(candidate.fromNodeId) ?? [])];
		while (queue.length > 0) {
			const nodeId = queue.shift()!;
			if (nodeId === candidate.toNodeId) return false;
			if (seen.has(nodeId)) continue;
			seen.add(nodeId);
			queue.push(...(outgoing.get(nodeId) ?? []));
		}
		return true;
	});
	return [...reduced, ...nonRequired];
}

/** Structure Map用に、`requires`の深さを安定した列番号へ投影する。 */
export function projectStructureMap(
	definition: ProductionBlueprintDefinition,
): StructureMapProjection {
	const incoming = new Map<string, string[]>();
	for (const edge of definition.edges) {
		if (edge.relation !== 'requires') continue;
		incoming.set(edge.toNodeId, [...(incoming.get(edge.toNodeId) ?? []), edge.fromNodeId]);
	}
	const depthByNodeId = new Map<string, number>();
	const visiting = new Set<string>();
	const depthFor = (nodeId: string): number => {
		const cached = depthByNodeId.get(nodeId);
		if (cached !== undefined) return cached;
		// 公開済みBlueprintはvalidateBlueprintで循環を拒否する。壊れた旧投影でも画面を止めない。
		if (visiting.has(nodeId)) return 0;
		visiting.add(nodeId);
		const predecessors = incoming.get(nodeId) ?? [];
		const depth = predecessors.length === 0 ? 0 : Math.max(...predecessors.map(depthFor)) + 1;
		visiting.delete(nodeId);
		depthByNodeId.set(nodeId, depth);
		return depth;
	};
	return {
		nodes: definition.nodes.map((node) => ({ ...node, layer: depthFor(node.id) })),
		edges: transitiveReduceRequires(definition),
	};
}

/** 依存を満たして現在着手できる対象だけを返す。順位付けは別ポリシーの責務。 */
export function projectReadinessFrontier(
	nodes: readonly BlueprintNode[],
	readinessByNodeId: ReadonlyMap<string, ReadinessStatus>,
): BlueprintNode[] {
	return nodes.filter((node) => readinessByNodeId.get(node.id) === 'ready');
}

export type ImpactSeverity = 'info' | 'review_required' | 'blocked';

export interface RippleImpact {
	nodeId: string;
	distance: number;
	severity: ImpactSeverity;
	/** sourceから対象までの最短のnode列。表示層はこれを業務用語へ解決する。 */
	path: string[];
}

/** 辺の意味を、創作上の通知と実際の納期ブロックへ混同せずに変換する。 */
export function severityForEdge(
	relation: ProcessEdgeRelation,
	options: { sourceWasGateEvidence: boolean; sourceIsMissing: boolean },
): ImpactSeverity {
	if (relation === 'requires' && options.sourceIsMissing) return 'blocked';
	if (relation === 'requires' || relation === 'feeds' || options.sourceWasGateEvidence) {
		return 'review_required';
	}
	return 'info';
}

const IMPACT_SEVERITY_RANK: Record<ImpactSeverity, number> = {
	info: 0,
	review_required: 1,
	blocked: 2,
};

/**
 * 変更または根拠失効を起点に、Blueprint上の下流へ届く影響を局所的に投影する。
 * Ripple Map自体を保存せず、常に正本のedgeから説明可能な最短経路を再計算する。
 */
export function projectRipple(
	definition: ProductionBlueprintDefinition,
	sourceNodeId: string,
	options: { sourceWasGateEvidence: boolean; sourceIsMissing: boolean },
): RippleImpact[] {
	const outgoing = new Map<string, BlueprintEdge[]>();
	for (const edge of definition.edges) {
		outgoing.set(edge.fromNodeId, [...(outgoing.get(edge.fromNodeId) ?? []), edge]);
	}
	const impacts = new Map<string, RippleImpact>();
	const queue: RippleImpact[] = [
		{ nodeId: sourceNodeId, distance: 0, severity: 'info', path: [sourceNodeId] },
	];
	while (queue.length > 0) {
		const current = queue.shift()!;
		for (const edge of outgoing.get(current.nodeId) ?? []) {
			const edgeSeverity = severityForEdge(edge.relation, options);
			const severity =
				IMPACT_SEVERITY_RANK[edgeSeverity] > IMPACT_SEVERITY_RANK[current.severity]
					? edgeSeverity
					: current.severity;
			const next: RippleImpact = {
				nodeId: edge.toNodeId,
				distance: current.distance + 1,
				severity,
				path: [...current.path, edge.toNodeId],
			};
			const existing = impacts.get(next.nodeId);
			const isBetterPath =
				!existing ||
				next.distance < existing.distance ||
				(next.distance === existing.distance &&
					IMPACT_SEVERITY_RANK[next.severity] > IMPACT_SEVERITY_RANK[existing.severity]);
			if (!isBetterPath) continue;
			impacts.set(next.nodeId, next);
			queue.push(next);
		}
	}
	return [...impacts.values()].sort(
		(a, b) =>
			IMPACT_SEVERITY_RANK[b.severity] - IMPACT_SEVERITY_RANK[a.severity] ||
			a.distance - b.distance ||
			a.nodeId.localeCompare(b.nodeId),
	);
}
