import { handleRequest } from "./platform/worker/router.ts";
import type { Env } from "./platform/cloudflare/env.ts";
import { handleScheduledCapture } from "./features/workflows/application/run-scheduled-capture.ts";

export { NewsSnapshotterWorkflow } from "./features/workflows/infrastructure/cloudflare-workflow.ts";

export default {
	fetch: handleRequest,
	scheduled: handleScheduledCapture,
} satisfies ExportedHandler<Env>;
