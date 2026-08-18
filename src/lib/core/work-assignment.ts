export const WORK_TARGET_TYPES = [
	'title',
	'timeline',
	'cut',
	'representation',
	'process_node',
] as const;
export type WorkTargetType = (typeof WORK_TARGET_TYPES)[number];

export function isWorkTargetType(value: unknown): value is WorkTargetType {
	return typeof value === 'string' && (WORK_TARGET_TYPES as readonly string[]).includes(value);
}
