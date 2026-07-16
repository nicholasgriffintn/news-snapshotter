import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';

import type { Env } from './env';
import { resolveCaptureProfile } from './capture-profiles';
import { captureDevice } from './browser-rendering';
import type { ScreenshotResult, SiteDefinition } from './types';

export type SnapshotWorkflowParams = {
	capturedAt: string;
	sites: SiteDefinition[];
};

export class NewsSnapshotterWorkflow extends WorkflowEntrypoint<Env, SnapshotWorkflowParams> {
	async run(event: WorkflowEvent<SnapshotWorkflowParams>, step: WorkflowStep) {
		const { capturedAt, sites } = event.payload;
		const results: ScreenshotResult[] = [];

		for (const site of sites) {
			const profile = resolveCaptureProfile(site);
			for (const device of profile.devices) {
				const result = await step.do(`screenshot-${site.name}-${device}`, () => {
					return captureDevice(this.env, site, device, capturedAt);
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
}
