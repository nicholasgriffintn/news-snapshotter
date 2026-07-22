import type { Env } from "../../../platform/cloudflare/env.ts";
import type { AnalysisMessage } from "../../comparison/domain/pipeline.ts";
import type { HistoryIndexMessage } from "../application/index-extraction.ts";
import { errorMessage } from "../../../core/errors.ts";

type ProcessingDestination = "analysis" | "history-index";
type ProcessingMessage = AnalysisMessage | HistoryIndexMessage;

export async function retainProcessingHandoff(
	database: D1Database,
	input: {
		destination: ProcessingDestination;
		message: ProcessingMessage;
		outboxId: string;
	},
): Promise<void> {
	await database
		.prepare(
			`INSERT INTO processing_outbox (
				outbox_id, destination, message_json, created_at
			) VALUES (?, ?, ?, ?)
			ON CONFLICT(outbox_id) DO UPDATE SET
				destination = excluded.destination,
				message_json = excluded.message_json`,
		)
		.bind(
			input.outboxId,
			input.destination,
			JSON.stringify(input.message),
			new Date().toISOString(),
		)
		.run();
}

export async function completeProcessingHandoff(
	database: D1Database,
	outboxId: string,
): Promise<void> {
	await database.prepare("DELETE FROM processing_outbox WHERE outbox_id = ?").bind(outboxId).run();
}

export async function failProcessingHandoff(
	database: D1Database,
	outboxId: string,
	error: unknown,
): Promise<void> {
	await database
		.prepare(
			`UPDATE processing_outbox SET
				attempt_count = attempt_count + 1,
				last_attempt_at = ?,
				last_error = ?
			WHERE outbox_id = ?`,
		)
		.bind(new Date().toISOString(), errorMessage(error), outboxId)
		.run();
}

export async function flushProcessingOutbox(
	database: D1Database,
	queues: Pick<Env, "ANALYSIS_QUEUE" | "HISTORY_INDEX_QUEUE">,
	limit = 100,
): Promise<{ failed: number; sent: number }> {
	const rows = await database
		.prepare(
			`SELECT outbox_id, destination, message_json
			FROM processing_outbox
			ORDER BY created_at, outbox_id
			LIMIT ?`,
		)
		.bind(limit)
		.all<{ destination: ProcessingDestination; message_json: string; outbox_id: string }>();
	let failed = 0;
	let sent = 0;
	for (const row of rows.results) {
		try {
			const message = JSON.parse(row.message_json) as ProcessingMessage;
			if (row.destination === "analysis") {
				await queues.ANALYSIS_QUEUE.send(message as AnalysisMessage);
			} else {
				await queues.HISTORY_INDEX_QUEUE.send(message as HistoryIndexMessage);
			}
			await completeProcessingHandoff(database, row.outbox_id);
			sent += 1;
		} catch (error) {
			await failProcessingHandoff(database, row.outbox_id, error);
			failed += 1;
		}
	}
	return { failed, sent };
}
