/**
 * design.md 13章 Phase1（Timeline+Cut+尺モデル）のCore。
 * Title作成／Timeline作成／Cut追加のdecide/evolveのみを扱う。
 * Submission/Version/Review/Seal/Issueは範囲外（design.mdの後続Phase）。
 */

export type TimelineEvent =
	| { type: 'TitleCreated'; payload: { titleId: string; name: string } }
	| {
			type: 'TimelineCreated';
			payload: { timelineId: string; titleId: string; season: string; episode: number };
	  }
	| {
			type: 'CutAdded';
			payload: {
				cutId: string;
				timelineId: string;
				number: string;
				sortOrder: number;
				plannedFrames: number;
				sceneTags: string[];
			};
	  };

export type TimelineCommand =
	| { type: 'CreateTitle'; titleId: string; name: string }
	| {
			type: 'CreateTimeline';
			timelineId: string;
			titleId: string;
			season: string;
			episode: number;
	  }
	| {
			type: 'AddCut';
			cutId: string;
			timelineId: string;
			number: string;
			sortOrder: number;
			plannedFrames: number;
			sceneTags: string[];
	  };

export type TimelineError =
	| { kind: 'blank_name' }
	| { kind: 'title_not_found' }
	| { kind: 'invalid_episode' }
	| { kind: 'non_positive_frames' }
	| { kind: 'duplicate_cut_number'; number: string }
	| { kind: 'duplicate_sort_order'; sortOrder: number };

export type TimelineDecideResult =
	| { ok: true; events: TimelineEvent[] }
	| { ok: false; error: TimelineError };

/**
 * ある1つのTimelineの現在状態（そのTimeline配下のCutAddedイベントを畳み込んだもの）。
 * カット番号・並び順の重複チェックに使う。
 */
export interface TimelineState {
	cutNumbers: ReadonlySet<string>;
	cutSortOrders: ReadonlySet<number>;
}

export function evolveTimeline(events: readonly TimelineEvent[]): TimelineState {
	const cutNumbers = new Set<string>();
	const cutSortOrders = new Set<number>();
	for (const event of events) {
		if (event.type === 'CutAdded') {
			cutNumbers.add(event.payload.number);
			cutSortOrders.add(event.payload.sortOrder);
		}
	}
	return { cutNumbers, cutSortOrders };
}

export interface TimelineContext {
	/** CreateTimelineの対象titleIdが実在するか（Shellがrepositoryで確認して渡す） */
	titleExists: boolean;
}

export function decideTimeline(
	command: TimelineCommand,
	state: TimelineState,
	context: TimelineContext
): TimelineDecideResult {
	switch (command.type) {
		case 'CreateTitle': {
			if (command.name.trim().length === 0) {
				return { ok: false, error: { kind: 'blank_name' } };
			}
			return {
				ok: true,
				events: [
					{ type: 'TitleCreated', payload: { titleId: command.titleId, name: command.name } }
				]
			};
		}

		case 'CreateTimeline': {
			if (!context.titleExists) {
				return { ok: false, error: { kind: 'title_not_found' } };
			}
			if (!Number.isInteger(command.episode) || command.episode < 1) {
				return { ok: false, error: { kind: 'invalid_episode' } };
			}
			return {
				ok: true,
				events: [
					{
						type: 'TimelineCreated',
						payload: {
							timelineId: command.timelineId,
							titleId: command.titleId,
							season: command.season,
							episode: command.episode
						}
					}
				]
			};
		}

		case 'AddCut': {
			if (command.plannedFrames <= 0) {
				return { ok: false, error: { kind: 'non_positive_frames' } };
			}
			if (state.cutNumbers.has(command.number)) {
				return { ok: false, error: { kind: 'duplicate_cut_number', number: command.number } };
			}
			if (state.cutSortOrders.has(command.sortOrder)) {
				return { ok: false, error: { kind: 'duplicate_sort_order', sortOrder: command.sortOrder } };
			}
			return {
				ok: true,
				events: [
					{
						type: 'CutAdded',
						payload: {
							cutId: command.cutId,
							timelineId: command.timelineId,
							number: command.number,
							sortOrder: command.sortOrder,
							plannedFrames: command.plannedFrames,
							sceneTags: command.sceneTags
						}
					}
				]
			};
		}
	}
}
