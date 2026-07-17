import { handleRequest } from "./api";
import type { Env } from "./env";

export { NewsSnapshotterWorkflow } from "./workflow";

export default {
	fetch: handleRequest,
} satisfies ExportedHandler<Env>;
