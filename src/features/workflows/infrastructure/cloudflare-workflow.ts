import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

import type { Env } from "../../../platform/cloudflare/env.ts";
import { runSnapshotWorkflow, type SnapshotWorkflowParams } from "../application/run-workflow.ts";

export type { SnapshotWorkflowParams } from "../application/run-workflow.ts";

export class NewsSnapshotterWorkflow extends WorkflowEntrypoint<Env, SnapshotWorkflowParams> {
	async run(event: WorkflowEvent<SnapshotWorkflowParams>, step: WorkflowStep) {
		return runSnapshotWorkflow(this.env, event.payload, step);
	}
}
