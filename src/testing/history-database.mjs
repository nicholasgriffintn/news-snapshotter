import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import { SQLiteD1 } from "./sqlite-d1.mjs";

const MIGRATIONS = [
	"0001_history.sql",
	"0002_failure_identity.sql",
	"0003_history_operations.sql",
	"0004_story_categories.sql",
	"0005_page_element_context.sql",
];

export async function createHistoryTestDatabase() {
	const sqlite = new DatabaseSync(":memory:");
	for (const migration of MIGRATIONS) {
		const sql = await readFile(new URL(`../../migrations/${migration}`, import.meta.url), "utf8");
		sqlite.exec(sql);
	}
	return { database: new SQLiteD1(sqlite), sqlite };
}
