/** MVP Relayで使うFile System Access APIの最小型。対応ブラウザだけで実行される。 */
interface JijiRelayFileHandle {
	createWritable(): Promise<{
		write(data: string | ArrayBuffer | ArrayBufferView | Blob): Promise<void>;
		close(): Promise<void>;
	}>;
}

interface JijiRelayDirectoryHandle {
	/** ブラウザが許可する選択フォルダの表示名。OSの絶対パスは公開されない。 */
	readonly name: string;
	queryPermission(options: { mode: 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
	requestPermission(options: { mode: 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
	getFileHandle(name: string, options?: { create?: boolean }): Promise<JijiRelayFileHandle>;
	/** ジョブのtargetRelativePathがサブフォルダを含む場合、Relay配送側で辿って作成する。 */
	getDirectoryHandle(
		name: string,
		options?: { create?: boolean },
	): Promise<JijiRelayDirectoryHandle>;
	removeEntry(name: string): Promise<void>;
}

interface Window {
	showDirectoryPicker?: (options?: { mode: 'readwrite' }) => Promise<JijiRelayDirectoryHandle>;
}
