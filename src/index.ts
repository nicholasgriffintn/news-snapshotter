import { handleScheduledCapture } from "./features/workflows/application/run-scheduled-capture.ts";
import type { Env } from "./platform/cloudflare/env.ts";
import { handleWorkerQueue, type WorkerQueueMessage } from "./platform/worker/queue.ts";
import { handleRequest } from "./platform/worker/router.ts";

export { NewsSnapshotterWorkflow } from "./features/workflows/infrastructure/cloudflare-workflow.ts";

export default {
	fetch: handleRequest,
	queue: handleWorkerQueue,
	scheduled: handleScheduledCapture,
} satisfies ExportedHandler<Env, WorkerQueueMessage>;
