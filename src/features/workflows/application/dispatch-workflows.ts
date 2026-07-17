import type { Env } from "../../../platform/cloudflare/env.ts";
import { resolveCaptureProfile } from "../../capture/domain/profiles.ts";
import { createWorkflowShards } from "../domain/workflow-batch.ts";
import type { SiteDefinition } from "../../../core/domain.ts";

export async function dispatchCaptureWorkflows(
	env: Pick<Env, "NEWS_SNAPSHOTTER">,
	sites: SiteDefinition[],
	triggeredAt: string,
) {
	const shards = createWorkflowShards(sites);
	const workflows = await Promise.all(
		shards.map(async (shard) => {
			const instance = await env.NEWS_SNAPSHOTTER.create({
				params: {
					sites: shard.sites,
					startDelaySeconds: shard.startDelaySeconds,
					triggeredAt,
				},
			});

			return {
				id: instance.id,
				siteCount: shard.sites.length,
				status: await instance.status(),
			};
		}),
	);
	const workflowIds = workflows.map((workflow) => {
		return workflow.id;
	});

	return {
		batchId: `capture-${triggeredAt.replace(/[:.]/g, "-")}`,
		runnerCount: workflows.length,
		selectedSites: sites.map((site) => {
			return {
				brand: site.brand,
				captureRegion: site.captureRegion,
				category: site.category,
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
