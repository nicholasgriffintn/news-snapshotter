import type { Env } from './env';
import { resolveCaptureProfile } from './capture-profiles.ts';
import { captureDevice } from './browser-rendering.ts';
import type { Device, ScreenshotResult, SiteDefinition } from './types';

export type SnapshotWorkflowParams = {
	sites: SiteDefinition[];
	startDelaySeconds?: number;
	triggeredAt: string;
};

type WorkflowStepLike = {
	do<T>(name: string, callback: () => Promise<T>): Promise<T>;
	sleep?(name: string, duration: `${number} seconds`): Promise<void>;
};

type CaptureDevice = (
	env: Pick<Env, 'ARCHIVE_DATA' | 'BROWSER' | 'CAPTURE_FAILURES' | 'SCREENSHOTS'>,
	site: SiteDefinition,
	device: Device,
	triggeredAt: string,
) => Promise<ScreenshotResult>;

export async function runSnapshotWorkflow(
	env: Env,
	params: SnapshotWorkflowParams,
	step: WorkflowStepLike,
	capture: CaptureDevice = captureDevice,
) {
	const { sites, triggeredAt } = params;
	const results: ScreenshotResult[] = [];
	if (params.startDelaySeconds && step.sleep) {
		const duration: `${number} seconds` = `${params.startDelaySeconds} seconds`;
		await step.sleep('stagger browser runner', duration);
	}

	for (const site of sites) {
		const profile = resolveCaptureProfile(site);
		for (const device of profile.devices) {
			const result = await step.do(`screenshot-${site.name}-${device}`, () => {
				return capture(env, site, device, triggeredAt);
			});
			results.push(result);
		}
	}

	return {
		failed: results.filter((result) => result.status === 'error').length,
		results,
		successful: results.filter((result) => result.status === 'success').length,
		totalCaptures: results.length,
		totalSites: sites.length,
		triggeredAt,
	};
}
