import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';

import type { Env } from './env';
import { errorMessage } from './lib/errors';
import { captureSite } from './browser-rendering';
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
			try {
				const result = await step.do(
					`screenshot-${site.name}`,
					{ retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' } },
					() => captureSite(this.env, site, capturedAt),
				);
				results.push(result);
			} catch (error) {
				results.push({ name: site.name, status: 'error', error: errorMessage(error) });
			}
		}

		return {
			capturedAt,
			failed: results.filter((result) => result.status === 'error').length,
			results,
			successful: results.filter((result) => result.status === 'success').length,
			totalSites: sites.length,
		};
	}
}
