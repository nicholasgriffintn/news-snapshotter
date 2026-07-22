import type { Env } from "../../../platform/cloudflare/env.ts";
import { resolveCaptureProfile } from "../../capture/domain/profiles.ts";
import { captureDevice } from "../../capture/application/capture-device.ts";
import type { Device, ScreenshotResult, SiteDefinition } from "../../../core/domain.ts";

export type SnapshotWorkflowParams = {
	enqueueComparison: boolean;
	sites: SiteDefinition[];
	startDelaySeconds?: number;
	triggeredAt: string;
};

type WorkflowStepLike = {
	do<T>(name: string, config: CaptureStepConfig, callback: () => Promise<T>): Promise<T>;
	sleep?(name: string, duration: `${number} seconds`): Promise<void>;
};

type CaptureStepConfig = {
	retries: {
		backoff: "constant";
		delay: "1 second";
		limit: 0;
	};
	timeout: "3 minutes";
};

const CAPTURE_STEP_CONFIG: CaptureStepConfig = {
	retries: { backoff: "constant", delay: "1 second", limit: 0 },
	timeout: "3 minutes",
};

type CaptureDevice = (
	env: Pick<
		Env,
		| "ARCHIVE_DATA"
		| "BROWSER"
		| "CAPTURE_FAILURES"
		| "HISTORY_DB"
		| "HISTORY_INDEX_QUEUE"
		| "HYPERBROWSER_API_KEY"
		| "SCREENSHOTS"
	>,
	site: SiteDefinition,
	device: Device,
	triggeredAt: string,
	enqueueComparison: boolean,
) => Promise<ScreenshotResult>;

export async function runSnapshotWorkflow(
	env: Env,
	params: SnapshotWorkflowParams,
	step: WorkflowStepLike,
	capture: CaptureDevice = captureDevice,
) {
	const { enqueueComparison, sites, triggeredAt } = params;
	const results: ScreenshotResult[] = [];
	if (params.startDelaySeconds && step.sleep) {
		const duration: `${number} seconds` = `${params.startDelaySeconds} seconds`;
		await step.sleep("stagger browser runner", duration);
	}

	for (const site of sites) {
		const profile = resolveCaptureProfile(site);
		for (const [deviceIndex, device] of profile.devices.entries()) {
			if (deviceIndex > 0 && site.interDeviceDelaySeconds && step.sleep) {
				const duration: `${number} seconds` = `${site.interDeviceDelaySeconds} seconds`;
				await step.sleep(`wait between ${site.name} devices`, duration);
			}
			const result = await step.do(`screenshot-${site.name}-${device}`, CAPTURE_STEP_CONFIG, () => {
				return capture(env, site, device, triggeredAt, enqueueComparison);
			});
			results.push(result);
		}
	}

	return {
		failed: results.filter((result) => result.status === "error").length,
		results,
		successful: results.filter((result) => result.status === "success").length,
		totalCaptures: results.length,
		totalSites: sites.length,
		triggeredAt,
	};
}
