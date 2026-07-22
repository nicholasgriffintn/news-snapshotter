export type Env = Cloudflare.Env & {
	ARCHIVE_DATA: R2Bucket;
	AI: Ai;
	ANALYSIS_QUEUE: Queue<import("../../features/comparison/domain/pipeline.ts").AnalysisMessage>;
	API_KEY: string;
	COMPARISON_CANARY_MODEL: string;
	COMPARISON_CANARY_PERCENT: string;
	HISTORY_DB: D1Database;
	HISTORY_INDEX_QUEUE: Queue<
		| import("../../features/history/application/index-extraction.ts").HistoryIndexMessage
		| import("../../features/history/application/materialise-history-month.ts").HistoryAggregateMessage
	>;
	HYPERBROWSER_API_KEY?: string;
	STORY_VECTORS: VectorizeIndex;
};
