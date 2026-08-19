import { AwsClient } from 'aws4fetch';
import type { RelayStorageConnectionRow } from './repository/relay-repository';

/**
 * design.md 9.6.2: Relayのファイル本体は組織指定Object Storageに置く。
 * providerごとの署名付きURL発行・list・deleteをここに閉じ込め、Shellのcommandからは
 * 「keyを渡せばURLが返る／消せる」という形でだけ使わせる。
 *
 * 現時点でS3互換API（s3 / s3_compatible / supabase）だけをサポートする。
 * gcs / azure_blobはprovider adapter未実装（設定はできるがRelay取得はエラーにする）。
 */

const SUPPORTED_PROVIDERS = new Set(['s3', 's3_compatible', 'supabase']);

export class RelayObjectStorageUnsupportedError extends Error {
	constructor(provider: string) {
		super(`Object Storage provider "${provider}" のRelay取得は未実装です。`);
		this.name = 'RelayObjectStorageUnsupportedError';
	}
}

export class RelayObjectStorageCredentialsMissingError extends Error {
	constructor() {
		super('この接続にはAccess Key ID / Secret Access Keyが設定されていません。');
		this.name = 'RelayObjectStorageCredentialsMissingError';
	}
}

export interface RelayStorageObject {
	key: string;
	size: number;
	etag: string | null;
}

function requireS3CompatibleClient(connection: RelayStorageConnectionRow): {
	client: AwsClient;
	bucketBaseUrl: string;
} {
	if (!SUPPORTED_PROVIDERS.has(connection.provider)) {
		throw new RelayObjectStorageUnsupportedError(connection.provider);
	}
	if (!connection.accessKeyId || !connection.secretAccessKey) {
		throw new RelayObjectStorageCredentialsMissingError();
	}
	const client = new AwsClient({
		accessKeyId: connection.accessKeyId,
		secretAccessKey: connection.secretAccessKey,
		service: 's3',
		region: connection.region ?? 'us-east-1',
	});
	const base =
		connection.provider === 's3' && !connection.endpoint
			? `https://s3.${connection.region ?? 'us-east-1'}.amazonaws.com`
			: (connection.endpoint?.replace(/\/+$/, '') ?? '');
	if (base.length === 0) {
		throw new Error('S3互換接続にはendpointが必要です。');
	}
	const bucketBaseUrl = `${base}/${encodeURIComponent(connection.bucketOrContainer)}`;
	return { client, bucketBaseUrl };
}

function decodeXmlEntities(value: string): string {
	return value
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&');
}

/** ListObjectsV2のXMLレスポンスから最小限（Key/Size/ETag）だけを読み取る。 */
function parseListObjectsV2(xml: string): RelayStorageObject[] {
	const objects: RelayStorageObject[] = [];
	const contentsBlocks = xml.match(/<Contents>[\s\S]*?<\/Contents>/g) ?? [];
	for (const block of contentsBlocks) {
		const keyMatch = block.match(/<Key>([\s\S]*?)<\/Key>/);
		const sizeMatch = block.match(/<Size>(\d+)<\/Size>/);
		const etagMatch = block.match(/<ETag>([\s\S]*?)<\/ETag>/);
		if (!keyMatch || !sizeMatch) continue;
		objects.push({
			key: decodeXmlEntities(keyMatch[1]),
			size: Number(sizeMatch[1]),
			etag: etagMatch ? decodeXmlEntities(etagMatch[1]).replace(/^"|"$/g, '') : null,
		});
	}
	return objects;
}

/** 登録済み接続のbucket/prefix配下にあるobjectを列挙する（1000件/ページ、ページングは追わない）。 */
export async function listRelayStorageObjects(
	connection: RelayStorageConnectionRow,
	prefix: string,
): Promise<RelayStorageObject[]> {
	const { client, bucketBaseUrl } = requireS3CompatibleClient(connection);
	const url = new URL(bucketBaseUrl);
	url.searchParams.set('list-type', '2');
	if (prefix.length > 0) url.searchParams.set('prefix', prefix);
	const response = await client.fetch(url.toString(), { method: 'GET' });
	if (!response.ok) {
		throw new Error(
			`Object Storageの一覧取得に失敗しました（HTTP ${response.status}）: ${await response.text()}`,
		);
	}
	return parseListObjectsV2(await response.text());
}

/** ブラウザ(Relay)が直接GETできる短寿命の署名付きURLを発行する。 */
export async function presignRelayObjectDownload(
	connection: RelayStorageConnectionRow,
	objectKey: string,
	expiresInSeconds = 300,
): Promise<string> {
	const { client, bucketBaseUrl } = requireS3CompatibleClient(connection);
	const url = new URL(`${bucketBaseUrl}/${objectKey.split('/').map(encodeURIComponent).join('/')}`);
	url.searchParams.set('X-Amz-Expires', String(expiresInSeconds));
	const signed = await client.sign(url.toString(), {
		method: 'GET',
		aws: { signQuery: true },
	});
	return signed.url;
}

/** objectが実在するかどうかをHEADで確認する（削除の再試行前に使う）。 */
export async function headRelayObject(
	connection: RelayStorageConnectionRow,
	objectKey: string,
): Promise<boolean> {
	const { client, bucketBaseUrl } = requireS3CompatibleClient(connection);
	const url = `${bucketBaseUrl}/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
	const response = await client.fetch(url, { method: 'HEAD' });
	if (response.status === 404) return false;
	if (!response.ok)
		throw new Error(`Object Storageの存在確認に失敗しました（HTTP ${response.status}）`);
	return true;
}

/**
 * 本番のDELETEはブラウザに署名URLを渡さず、Jijiサーバーが直接実行する（design.md 9.6.2）。
 * 常に対象フォルダ配下の個々のobject keyだけを指定して消す（フォルダ自体を消すAPI呼び出しは無い）。
 * 既に存在しない場合も削除成功として扱う（design.md 9.6.6の再試行冪等性）。
 */
export async function deleteRelayObject(
	connection: RelayStorageConnectionRow,
	objectKey: string,
): Promise<void> {
	const { client, bucketBaseUrl } = requireS3CompatibleClient(connection);
	const url = `${bucketBaseUrl}/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
	const response = await client.fetch(url, { method: 'DELETE' });
	if (!response.ok && response.status !== 404) {
		throw new Error(`Object Storageからの削除に失敗しました（HTTP ${response.status}）`);
	}
}
