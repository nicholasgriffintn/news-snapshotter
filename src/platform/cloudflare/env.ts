export type Env = Cloudflare.Env & {
	ARCHIVE_DATA: R2Bucket;
	API_KEY: string;
	HISTORY_DB: D1Database;
	HISTORY_INDEX_QUEUE?: Queue<
		import("../../features/history/application/index-extraction.ts").HistoryIndexMessage
	>;
	HYPERBROWSER_API_KEY?: string;
};
