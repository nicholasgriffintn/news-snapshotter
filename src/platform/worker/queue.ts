import { errorMessage } from "../../core/errors.ts";
import { processAnalysisMessage } from "../../features/comparison/application/handle-analysis-queue.ts";
import {
	analysisRetryDelaySeconds,
	isRetryableAnalysisError,
	type AnalysisMessage,
} from "../../features/comparison/domain/pipeline.ts";
import {
	type HistoryIndexMessage,
	indexExtractionArtefact,
} from "../../features/history/application/index-extraction.ts";
import {
	type HistoryAggregateMessage,
	processHistoryAggregateMessage,
} from "../../features/history/application/materialise-history-month.ts";
import type { Env } from "../cloudflare/env.ts";

export type WorkerQueueMessage = AnalysisMessage | HistoryAggregateMessage | HistoryIndexMessage;

function isAnalysisMessage(message: WorkerQueueMessage): message is AnalysisMessage {
	return message.kind === "analyse-capture" || message.kind === "finalise-window";
}

function isHistoryAggregateMessage(
	message: WorkerQueueMessage,
): message is HistoryAggregateMessage {
	return message.kind === "materialise-history-month";
}

export async function handleWorkerQueue(
	batch: MessageBatch<WorkerQueueMessage>,
	env: Env,
): Promise<void> {
	for (const message of batch.messages) {
		try {
			if (isAnalysisMessage(message.body)) {
				await processAnalysisMessage(env, message.body);
			} else if (isHistoryAggregateMessage(message.body)) {
				await processHistoryAggregateMessage(env.HISTORY_DB, message.body);
			} else {
				await indexExtractionArtefact(env, message.body);
			}
			message.ack();
		} catch (error) {
			console.error("Queue message failed", {
				error: errorMessage(error),
				kind: message.body.kind,
				queue: batch.queue,
			});

			if (!isAnalysisMessage(message.body)) {
				message.retry();
			} else if (isRetryableAnalysisError(error)) {
				message.retry({ delaySeconds: analysisRetryDelaySeconds(message.attempts) });
			} else {
				message.ack();
			}
		}
	}
}
