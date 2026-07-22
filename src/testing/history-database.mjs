import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import { SQLiteD1 } from "./sqlite-d1.mjs";

const MIGRATIONS = [
	"0001_history.sql",
	"0002_failure_identity.sql",
	"0003_history_operations.sql",
	"0004_story_categories.sql",
	"0005_page_element_context.sql",
	"0006_page_element_prominence.sql",
	"0007_page_element_timeline.sql",
	"0008_unified_content_observations.sql",
	"0009_remove_story_storage.sql",
	"0010_indexed_desktop_captures.sql",
	"0011_page_element_placements.sql",
	"0012_correct_failure_devices.sql",
	"0013_news_comparison.sql",
	"0014_comparison_query_indexes.sql",
	"0015_history_aggregate_runs.sql",
	"0016_saved_timeline_listing.sql",
	"0017_history_lifecycle.sql",
	"0018_processing_outbox.sql",
];

export async function createHistoryTestDatabase() {
	const sqlite = new DatabaseSync(":memory:");
	for (const migration of MIGRATIONS) {
		const sql = await readFile(new URL(`../../migrations/${migration}`, import.meta.url), "utf8");
		sqlite.exec(sql);
	}
	return { database: new SQLiteD1(sqlite), sqlite };
}
