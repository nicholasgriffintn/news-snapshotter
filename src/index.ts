import { errorMessage } from "./core/errors.ts";
import { processAnalysisMessage } from "./features/comparison/application/handle-analysis-queue.ts";
import {
	analysisRetryDelaySeconds,
	isRetryableAnalysisError,
	type AnalysisMessage,
} from "./features/comparison/domain/pipeline.ts";
import {
	indexExtractionArtefact,
	type HistoryIndexMessage,
} from "./features/history/application/index-extraction.ts";
import { handleScheduledCapture } from "./features/workflows/application/run-scheduled-capture.ts";
import type { Env } from "./platform/cloudflare/env.ts";
import { handleRequest } from "./platform/worker/router.ts";

export { NewsSnapshotterWorkflow } from "./features/workflows/infrastructure/cloudflare-workflow.ts";

type WorkerQueueMessage = AnalysisMessage | HistoryIndexMessage;

function isAnalysisMessage(message: WorkerQueueMessage): message is AnalysisMessage {
	return message.kind === "analyse-capture" || message.kind === "finalise-window";
}

async function handleQueue(batch: MessageBatch<WorkerQueueMessage>, env: Env): Promise<void> {
	for (const message of batch.messages) {
		try {
			if (isAnalysisMessage(message.body)) {
				await processAnalysisMessage(env, message.body);
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

export default {
	fetch: handleRequest,
	queue: handleQueue,
	scheduled: handleScheduledCapture,
} satisfies ExportedHandler<Env, WorkerQueueMessage>;
