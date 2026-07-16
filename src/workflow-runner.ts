import type { Env } from './env';
import { resolveCaptureProfile } from './capture-profiles.ts';
import { captureDevice } from './browser-rendering.ts';
import type { Device, ScreenshotResult, SiteDefinition } from './types';

export type SnapshotWorkflowParams = {
	capturedAt: string;
	sites: SiteDefinition[];
};

type WorkflowStepLike = {
	do<T>(name: string, callback: () => Promise<T>): Promise<T>;
};

type CaptureDevice = (
	env: Pick<Env, 'BROWSER' | 'CAPTURE_FAILURES' | 'SCREENSHOTS'>,
	site: SiteDefinition,
	device: Device,
	capturedAt: string,
) => Promise<ScreenshotResult>;

export async function runSnapshotWorkflow(
	env: Env,
	params: SnapshotWorkflowParams,
	step: WorkflowStepLike,
	capture: CaptureDevice = captureDevice,
) {
	const { capturedAt, sites } = params;
	const results: ScreenshotResult[] = [];

	for (const site of sites) {
		const profile = resolveCaptureProfile(site);
		for (const device of profile.devices) {
			const result = await step.do(`screenshot-${site.name}-${device}`, () => {
				return capture(env, site, device, capturedAt);
			});
			results.push(result);
		}
	}

	return {
		capturedAt,
		failed: results.filter((result) => result.status === 'error').length,
		results,
		successful: results.filter((result) => result.status === 'success').length,
		totalCaptures: results.length,
		totalSites: sites.length,
	};
}
