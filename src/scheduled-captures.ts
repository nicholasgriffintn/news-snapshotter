import { dispatchCaptureWorkflows } from "./capture-dispatch.ts";
import { SITES } from "./constants.ts";
import type { Env } from "./env";
import { selectSites } from "./lib/site-catalogue.ts";

export async function handleScheduledCapture(
	controller: ScheduledController,
	env: Env,
): Promise<void> {
	const sites = selectSites(SITES, {
		priority: 1,
	});
	const triggeredAt = new Date(controller.scheduledTime).toISOString();
	const dispatch = await dispatchCaptureWorkflows(
		env,
		sites,
		triggeredAt,
	);

	console.log(JSON.stringify({
		batchId: dispatch.batchId,
		event: "scheduled-capture-dispatched",
		priority: 1,
		runnerCount: dispatch.runnerCount,
		siteCount: dispatch.selectedSites.length,
		triggeredAt,
	}));
}
