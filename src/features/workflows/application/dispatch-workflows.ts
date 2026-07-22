import type { Env } from "../../../platform/cloudflare/env.ts";
import { resolveCaptureProfile } from "../../capture/domain/profiles.ts";
import { createWorkflowShards } from "../domain/workflow-batch.ts";
import type { SiteDefinition } from "../../../core/domain.ts";
import { errorMessage } from "../../../core/errors.ts";

export async function dispatchCaptureWorkflows(
	env: Pick<Env, "NEWS_SNAPSHOTTER">,
	sites: SiteDefinition[],
	triggeredAt: string,
	enqueueComparison: boolean,
) {
	const shards = createWorkflowShards(sites);
	const workflows = await Promise.all(
		shards.map(async (shard) => {
			let instance: Awaited<ReturnType<Env["NEWS_SNAPSHOTTER"]["create"]>>;
			try {
				instance = await env.NEWS_SNAPSHOTTER.create({
					params: {
						enqueueComparison,
						sites: shard.sites,
						startDelaySeconds: shard.startDelaySeconds,
						triggeredAt,
					},
				});
			} catch (error) {
				return {
					error: errorMessage(error),
					siteCount: shard.sites.length,
					status: "dispatch-failed" as const,
				};
			}

			let status:
				| Awaited<ReturnType<typeof instance.status>>
				| { error: string; status: "unavailable" };
			try {
				status = await instance.status();
			} catch (error) {
				status = { error: errorMessage(error), status: "unavailable" };
			}

			return {
				id: instance.id,
				siteCount: shard.sites.length,
				status,
			};
		}),
	);
	const workflowIds = workflows.flatMap((workflow) => ("id" in workflow ? [workflow.id] : []));

	return {
		batchId: `capture-${triggeredAt.replace(/[:.]/g, "-")}`,
		failedRunnerCount: workflows.length - workflowIds.length,
		runnerCount: shards.length,
		selectedSites: sites.map((site) => {
			return {
				brand: site.brand,
				captureRegion: site.captureRegion,
				category: site.category,
				displayName: site.displayName,
				name: site.name,
				priority: site.priority,
				provider: resolveCaptureProfile(site).provider,
			};
		}),
		triggeredAt,
		workflowId: workflowIds[0],
		workflowIds,
		workflows,
	};
}
