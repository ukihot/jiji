import * as m from '$lib/paraglide/messages';

/**
 * Relayの接続状態はページ単位ではなくブラウザ単位の関心事（design.md 9.6.1「端末・ブラウザ単位の設定」）。
 * ヘッダーのバッジと/relayページの両方が同じ状態を見られるよう、Svelte 5のモジュールrunesで
 * アプリ全体の単一インスタンスとして持つ。ログイン直後に前回のDirectory Handleへ黙って
 * 再接続できるのが目的で、`requestPermission`はユーザー操作の文脈でなければ静かに失敗するため、
 * このモジュール自体はsilent/manualを区別しない（呼び出し元がボタンonclick内かどうかで決まる）。
 */

export type RelayConnectionStatus = 'idle' | 'connecting' | 'online' | 'checking' | 'offline';

export interface RelayConnectionInfo {
	status: RelayConnectionStatus;
	relayId: string | null;
	displayName: string;
	folderName: string | null;
	message: string;
	storageConnectionId: string | null;
}

export const relayConnection: RelayConnectionInfo = $state({
	status: 'idle',
	relayId: null,
	displayName: '',
	folderName: null,
	message: '',
	storageConnectionId: null,
});

const HANDLE_STORE = 'handles';
const DB_NAME = 'jiji-relay';
const API_TIMEOUT_MS = 15_000;
const HEARTBEAT_INTERVAL_MS = 20_000;
const ACTIVE_CONNECTION_STORAGE_KEY = 'jiji-relay-active-connection-id';

interface StoredRelayConnectionRecord {
	relayId: string | null;
	displayName: string;
	folderName: string | null;
	titleId: string;
	storageConnectionId: string;
}

interface RelayApiStatusResult {
	relayId?: string;
	status: 'online' | 'checking' | 'offline';
}

let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
let activeHandle: JijiRelayDirectoryHandle | null = null;

export function browserInstanceId(): string {
	const key = 'jiji-relay-browser-instance-id';
	const existing = localStorage.getItem(key);
	if (existing) return existing;
	const created = crypto.randomUUID();
	localStorage.setItem(key, created);
	return created;
}

function recordKey(connectionId: string): string {
	return `jiji-relay:${connectionId}`;
}

/** /relayページが接続先を切り替えたとき、以前の登録情報をUIへ先読み表示するために使う。 */
export function getStoredRelayRecord(connectionId: string): StoredRelayConnectionRecord | null {
	const raw = localStorage.getItem(recordKey(connectionId));
	if (!raw) return null;
	try {
		return JSON.parse(raw) as StoredRelayConnectionRecord;
	} catch {
		return null;
	}
}

/** registerRelayConnectionが成功後に呼ぶ。ここだけがACTIVE_CONNECTION_STORAGE_KEYを更新する。 */
function saveStoredRecord(record: StoredRelayConnectionRecord): void {
	localStorage.setItem(recordKey(record.storageConnectionId), JSON.stringify(record));
	localStorage.setItem(ACTIVE_CONNECTION_STORAGE_KEY, record.storageConnectionId);
}

function relayApiErrorMessage(statusCode: number): string {
	if (statusCode === 401) return m.relay_api_login_required();
	if (statusCode === 403) return m.relay_api_permission_required();
	if (statusCode === 404) return m.relay_api_storage_not_found();
	if (statusCode === 400) return m.relay_api_invalid_request();
	return m.relay_api_server_error();
}

function openHandleDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => request.result.createObjectStore(HANDLE_STORE);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export async function readHandle(connectionId: string): Promise<JijiRelayDirectoryHandle | null> {
	const db = await openHandleDb();
	try {
		return await new Promise((resolve, reject) => {
			const request = db
				.transaction(HANDLE_STORE)
				.objectStore(HANDLE_STORE)
				.get(recordKey(connectionId));
			request.onsuccess = () =>
				resolve((request.result as JijiRelayDirectoryHandle | undefined) ?? null);
			request.onerror = () => reject(request.error);
		});
	} finally {
		db.close();
	}
}

export async function saveHandle(
	connectionId: string,
	handle: JijiRelayDirectoryHandle,
): Promise<void> {
	const db = await openHandleDb();
	try {
		await new Promise<void>((resolve, reject) => {
			const request = db
				.transaction(HANDLE_STORE, 'readwrite')
				.objectStore(HANDLE_STORE)
				.put(handle, recordKey(connectionId));
			request.onsuccess = () => resolve();
			request.onerror = () =>
				reject(
					new Error(
						m.relay_handle_save_failed({ reason: request.error?.name ?? 'IndexedDB error' }),
					),
				);
		});
	} finally {
		db.close();
	}
}

export async function checkWritable(handle: JijiRelayDirectoryHandle): Promise<void> {
	let permission = await handle.queryPermission({ mode: 'readwrite' });
	if (permission !== 'granted') permission = await handle.requestPermission({ mode: 'readwrite' });
	if (permission !== 'granted') throw new Error(m.relay_permission_denied());

	const probeName = `.jiji-relay-probe-${crypto.randomUUID()}`;
	const file = await handle.getFileHandle(probeName, { create: true });
	const writable = await file.createWritable();
	await writable.write('jiji relay probe');
	await writable.close();
	await handle.removeEntry(probeName);
}

export async function postJson<T>(
	path: string,
	body: Record<string, unknown>,
	timeoutMs = API_TIMEOUT_MS,
): Promise<T> {
	const controller = new AbortController();
	let timedOut = false;
	const timeout = window.setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, timeoutMs);
	try {
		const response = await fetch(path, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body),
			signal: controller.signal,
		});
		if (!response.ok) throw new Error(relayApiErrorMessage(response.status));
		return (await response.json()) as T;
	} catch (error) {
		if (timedOut) throw new Error(m.relay_cloud_timeout());
		throw error;
	} finally {
		window.clearTimeout(timeout);
	}
}

async function sendHeartbeat(): Promise<void> {
	if (!activeHandle || !relayConnection.relayId) return;
	const relayId = relayConnection.relayId;
	try {
		await checkWritable(activeHandle);
		const result = await postJson<RelayApiStatusResult>('/api/relay/heartbeat', {
			relayId,
			writable: true,
		});
		relayConnection.status = result.status;
		relayConnection.message = m.relay_online_message();
	} catch (error) {
		relayConnection.status = 'offline';
		relayConnection.message =
			error instanceof Error ? error.message : m.relay_connection_unavailable();
		await postJson('/api/relay/heartbeat', {
			relayId,
			writable: false,
			lastErrorCode: 'directory_unavailable',
		}).catch(() => undefined);
	}
}

export function stopRelayHeartbeat(): void {
	if (heartbeatTimer) clearInterval(heartbeatTimer);
	heartbeatTimer = undefined;
}

function startRelayHeartbeat(): void {
	stopRelayHeartbeat();
	heartbeatTimer = setInterval(() => void sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
}

export interface RegisterRelayConnectionParams {
	handle: JijiRelayDirectoryHandle;
	titleId: string;
	storageConnectionId: string;
	displayName: string;
	folderName: string;
}

/** Directory Handleの書込み検証→クラウド登録→heartbeat開始までを一貫して行う共通処理。 */
export async function registerRelayConnection(
	params: RegisterRelayConnectionParams,
): Promise<void> {
	const currentBrowserInstanceId = browserInstanceId();
	relayConnection.message = m.relay_checking_folder_message();
	await checkWritable(params.handle);
	relayConnection.message = m.relay_registering_message();
	const result = await postJson<RelayApiStatusResult>('/api/relay/register', {
		titleId: params.titleId,
		storageConnectionId: params.storageConnectionId,
		browserInstanceId: currentBrowserInstanceId,
		displayName: params.displayName,
		// 選択済みDirectory Handle自体がルート。パスは送らず、ブラウザ単位の論理IDだけを記録する。
		allowedRootKey: `browser-root:${currentBrowserInstanceId}`,
		writable: true,
	});
	if (!result.relayId) throw new Error(m.relay_id_missing());

	activeHandle = params.handle;
	relayConnection.relayId = result.relayId;
	relayConnection.status = result.status;
	relayConnection.displayName = params.displayName;
	relayConnection.folderName = params.folderName;
	relayConnection.storageConnectionId = params.storageConnectionId;
	relayConnection.message = m.relay_started_message();

	saveStoredRecord({
		relayId: result.relayId,
		displayName: params.displayName,
		folderName: params.folderName,
		titleId: params.titleId,
		storageConnectionId: params.storageConnectionId,
	});

	startRelayHeartbeat();
}

export function markRelayConnectionFailed(error: unknown, fallbackMessage: string): void {
	relayConnection.status = 'offline';
	relayConnection.message = error instanceof Error ? error.message : fallbackMessage;
}

/**
 * ログイン直後・ページ再読込のたびに、前回登録した社内共有フォルダへ黙って再接続を試みる。
 * `requestPermission`はユーザー操作の文脈でなければ実際にはプロンプトを出さず静かに失敗するため、
 * ここでは特別扱いせず`checkWritable`をそのまま呼ぶ。すでに許可済みならそのまま繋がり、
 * 未許可なら例外を投げて`offline`表示に留まる（/relayページの「再開」ボタンで明示的に再許可できる）。
 */
export async function resumeActiveRelayConnection(): Promise<void> {
	if (typeof window === 'undefined' || relayConnection.status === 'connecting') return;
	const activeConnectionId = localStorage.getItem(ACTIVE_CONNECTION_STORAGE_KEY);
	if (!activeConnectionId) return;
	const record = getStoredRelayRecord(activeConnectionId);
	if (!record) return;

	relayConnection.status = 'connecting';
	relayConnection.message = m.relay_resuming_message();
	try {
		const handle = await readHandle(activeConnectionId);
		if (!handle) throw new Error(m.relay_registered_folder_missing());
		await registerRelayConnection({
			handle,
			titleId: record.titleId,
			storageConnectionId: record.storageConnectionId,
			displayName: record.displayName,
			folderName: handle.name,
		});
	} catch (error) {
		markRelayConnectionFailed(error, m.relay_resume_failed());
	}
}
