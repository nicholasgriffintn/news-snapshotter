import { dispatchCaptureWorkflows } from "./dispatch-workflows.ts";
import { SITES } from "../../catalogue/domain/sites.ts";
import type { Env } from "../../../platform/cloudflare/env.ts";
import { selectSites } from "../../catalogue/domain/site-catalogue.ts";
import { errorMessage } from "../../../core/errors.ts";
import { scheduleComparisonWindows } from "../../comparison/application/handle-analysis-queue.ts";
import {
	enqueueHistoryAggregateMonth,
	previousUtcMonth,
} from "../../history/application/materialise-history-month.ts";

export const MONTHLY_HISTORY_AGGREGATE_CRON = "15 3 2,7,14 * *";

export async function handleScheduledCapture(
	controller: ScheduledController,
	env: Env,
): Promise<void> {
	const triggeredAt = new Date(controller.scheduledTime).toISOString();
	if (controller.cron === MONTHLY_HISTORY_AGGREGATE_CRON) {
		const month = previousUtcMonth(controller.scheduledTime);
		const siteCount = await enqueueHistoryAggregateMonth(
			env.HISTORY_DB,
			env.HISTORY_INDEX_QUEUE,
			month,
		);
		console.log(
			JSON.stringify({
				event: "history-month-materialisation-enqueued",
				month,
				siteCount,
				triggeredAt,
			}),
		);
		return;
	}
	const sites = selectSites(SITES, {
		priority: 1,
	});
	const dispatch = await dispatchCaptureWorkflows(env, sites, triggeredAt);
	try {
		await scheduleComparisonWindows(env, sites, triggeredAt);
	} catch (error) {
		console.error(
			JSON.stringify({
				error: errorMessage(error),
				event: "comparison-window-scheduling-failed",
				triggeredAt,
			}),
		);
	}

	console.log(
		JSON.stringify({
			batchId: dispatch.batchId,
			event: "scheduled-capture-dispatched",
			priority: 1,
			runnerCount: dispatch.runnerCount,
			siteCount: dispatch.selectedSites.length,
			triggeredAt,
		}),
	);
}
