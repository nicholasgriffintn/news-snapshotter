import { handleRequest } from "./api";
import type { Env } from "./env";
import { handleScheduledCapture } from "./scheduled-captures.ts";

export { NewsSnapshotterWorkflow } from "./workflow";

export default {
	fetch: handleRequest,
	scheduled: handleScheduledCapture,
} satisfies ExportedHandler<Env>;
