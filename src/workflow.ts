import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

import type { Env } from "./env";
import { runSnapshotWorkflow, type SnapshotWorkflowParams } from "./workflow-runner.ts";

export type { SnapshotWorkflowParams } from "./workflow-runner.ts";

export class NewsSnapshotterWorkflow extends WorkflowEntrypoint<Env, SnapshotWorkflowParams> {
	async run(event: WorkflowEvent<SnapshotWorkflowParams>, step: WorkflowStep) {
		return runSnapshotWorkflow(this.env, event.payload, step);
	}
}
