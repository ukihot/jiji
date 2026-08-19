/** Relayは端末の一時的な能力。DBに状態フラグを正本として持たずheartbeatから導出する。 */
export type RelayStatus = 'online' | 'checking' | 'offline';
export type RelayTransferJobState = 'pending' | 'leased' | 'delivered' | 'failed';
export type RelaySourceDeleteState =
	| 'not_ready'
	| 'pending'
	| 'deleting'
	| 'deleted'
	| 'retryable_error';

export interface RelayStatusInput {
	lastHeartbeatAt: Date | null;
	writable: boolean;
	now: Date;
}

export function deriveRelayStatus({
	lastHeartbeatAt,
	writable,
	now,
}: RelayStatusInput): RelayStatus {
	if (!writable || !lastHeartbeatAt) return 'offline';
	const elapsedMs = Math.max(0, now.getTime() - lastHeartbeatAt.getTime());
	if (elapsedMs <= 60_000) return 'online';
	if (elapsedMs <= 120_000) return 'checking';
	return 'offline';
}

/** 選択した社内共有フォルダのルートから外へ出る相対pathを受け入れない。 */
export function isSafeTargetRelativePath(path: string): boolean {
	if (path.length === 0 || path.length > 1024) return false;
	if (path.startsWith('/') || path.startsWith('\\') || /^[a-zA-Z]:[\\/]/.test(path)) return false;
	const segments = path.split(/[\\/]/);
	return segments.every(
		(segment) =>
			segment.length > 0 &&
			segment !== '.' &&
			segment !== '..' &&
			!/[<>:"|?*\u0000-\u001f]/.test(segment),
	);
}

export interface RelayJobClaimInput {
	jobState: RelayTransferJobState;
	leaseUntil: Date | null;
	relayStatus: RelayStatus;
	now: Date;
}

export type RelayJobClaimDecision =
	| { ok: true }
	| { ok: false; reason: 'relay_unavailable' | 'job_not_available' };

/** lease切れのjobだけを再貸出できる。DB側はこの決定を条件付きUPDATEとして実行する。 */
export function decideRelayJobClaim(input: RelayJobClaimInput): RelayJobClaimDecision {
	if (input.relayStatus !== 'online') return { ok: false, reason: 'relay_unavailable' };
	const canClaim =
		input.jobState === 'pending' ||
		(input.jobState === 'leased' &&
			input.leaseUntil !== null &&
			input.leaseUntil.getTime() < input.now.getTime());
	return canClaim ? { ok: true } : { ok: false, reason: 'job_not_available' };
}

export interface RelayDeliveryVerificationInput {
	expectedSize: number;
	/** バケット直置きをlist scanで発見しただけのjobはnull（出稿元でsha256を計算していない）。 */
	expectedSha256: string | null;
	actualSize: number;
	actualSha256: string;
}

export type RelayDeliveryVerificationDecision =
	| { ok: true; nextState: 'delivered'; nextSourceDeleteState: 'pending' }
	| { ok: false; reason: 'size_mismatch' | 'sha256_mismatch' };

/**
 * 社内共有フォルダへ確定したファイルを再読込して得た値だけで配送成功を判定する。
 * 成功後もオブジェクト削除が完了するまでは、出稿全体を完了扱いにしない。
 * expectedSha256が無い（list scan発見job）場合はサイズ一致のみで判定する。
 */
export function decideRelayDeliveryVerification(
	input: RelayDeliveryVerificationInput,
): RelayDeliveryVerificationDecision {
	if (input.actualSize !== input.expectedSize) return { ok: false, reason: 'size_mismatch' };
	if (
		input.expectedSha256 !== null &&
		input.actualSha256.toLowerCase() !== input.expectedSha256.toLowerCase()
	) {
		return { ok: false, reason: 'sha256_mismatch' };
	}
	return { ok: true, nextState: 'delivered', nextSourceDeleteState: 'pending' };
}

/**
 * Object Storageのobject keyから、prefixとRelayルートに対する相対パスを導く。
 * prefix外や空のkeyは受け付けない（isSafeTargetRelativePathで最終的な脱出も防ぐ）。
 */
export function deriveRelayTargetRelativePath(objectKey: string, prefix: string): string | null {
	const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, '');
	const withoutPrefix =
		normalizedPrefix.length > 0 && objectKey.startsWith(`${normalizedPrefix}/`)
			? objectKey.slice(normalizedPrefix.length + 1)
			: normalizedPrefix.length === 0
				? objectKey
				: null;
	if (!withoutPrefix || withoutPrefix.length === 0) return null;
	if (withoutPrefix.endsWith('/')) return null; // ディレクトリマーカーobjectは配送対象にしない
	return isSafeTargetRelativePath(withoutPrefix) ? withoutPrefix : null;
}

export interface RelaySourceDelivery {
	state: RelayTransferJobState;
	expectedSize: number;
	expectedSha256: string;
	deliveredSize: number | null;
	deliveredSha256: string | null;
}

export interface RelaySourceCleanupInput {
	deliveries: readonly RelaySourceDelivery[];
	sourceDeleteState: RelaySourceDeleteState;
}

export type RelaySourceCleanupDecision =
	| { action: 'wait_for_all_shared_folder_deliveries' }
	| { action: 'delete_source_object' }
	| { action: 'confirm_source_absent' }
	| { action: 'already_deleted' };

/**
 * 同一source objectを参照する配送先が複数あっても、全件の共有フォルダ書込みとハッシュ照合が済むまで削除しない。
 * DELETEのタイムアウト時は存在確認を先に行い、再送で削除済みobjectを誤って失敗扱いにしない。
 */
export function decideRelaySourceCleanup({
	deliveries,
	sourceDeleteState,
}: RelaySourceCleanupInput): RelaySourceCleanupDecision {
	const everyDeliveryVerified =
		deliveries.length > 0 &&
		deliveries.every(
			(delivery) =>
				delivery.state === 'delivered' &&
				delivery.deliveredSize === delivery.expectedSize &&
				delivery.deliveredSha256?.toLowerCase() === delivery.expectedSha256.toLowerCase(),
		);
	if (!everyDeliveryVerified) return { action: 'wait_for_all_shared_folder_deliveries' };
	if (sourceDeleteState === 'deleted') return { action: 'already_deleted' };
	if (sourceDeleteState === 'deleting') return { action: 'confirm_source_absent' };
	return { action: 'delete_source_object' };
}

export const RELAY_STORAGE_PROVIDERS = [
	's3',
	's3_compatible',
	'supabase',
	'gcs',
	'azure_blob',
] as const;
export type RelayStorageProvider = (typeof RELAY_STORAGE_PROVIDERS)[number];

export interface RelayStorageConfigInput {
	provider: RelayStorageProvider;
	endpoint: string | null;
	bucketOrContainer: string;
	prefix: string;
	authRef: string;
}

export function isRelayStorageProvider(value: unknown): value is RelayStorageProvider {
	return (
		typeof value === 'string' && (RELAY_STORAGE_PROVIDERS as readonly string[]).includes(value)
	);
}

/** 秘密値ではなくsecret store参照名だけを受け取るRelay Storage設定のバリデーション。 */
export function validateRelayStorageConfig(input: RelayStorageConfigInput): string | null {
	if (input.bucketOrContainer.trim().length === 0) return 'bucket_or_container_required';
	if (input.authRef.trim().length === 0) return 'auth_ref_required';
	if (
		(input.provider === 's3_compatible' || input.provider === 'supabase') &&
		(!input.endpoint || input.endpoint.trim().length === 0)
	) {
		return 'endpoint_required';
	}
	if (input.prefix.startsWith('/') || input.prefix.split('/').some((part) => part === '..')) {
		return 'invalid_prefix';
	}
	return null;
}
