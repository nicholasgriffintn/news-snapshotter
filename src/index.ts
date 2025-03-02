import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import type { Workflow } from '@cloudflare/workers-types';

import { SITES } from './constants';

type Env = {
	NEWS_SNAPSHOTTER: Workflow;
	ASSISTANT_API_URL: string;
	ASSISTANT_API_KEY: string;
};

type Params = {
	sites?: string[];
};

export class NewsSnapshotterWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
		const sitesToSnapshot = event.payload?.sites || SITES;
		const apiUrl = event.payload?.apiUrl;
    const apiKey = event.payload?.apiKey;

		if (!apiUrl || !apiKey) {
			throw new Error('API URL and API Key are required');
		}

		const startInfo = await step.do('initialize-workflow', async () => {
			return {
				startTime: new Date().toISOString(),
				sitesCount: sitesToSnapshot.length,
				sites: sitesToSnapshot,
			};
		});

		const batchSize = 3;
		const results: any[] = [];

		for (let i = 0; i < sitesToSnapshot.length; i += batchSize) {
			const batch = sitesToSnapshot.slice(i, i + batchSize);

			const batchResults = await step.do(
				`process-batch-${Math.floor(i / batchSize) + 1}`,
				{
					retries: {
						limit: 3,
						delay: '10 seconds',
						backoff: 'exponential',
					},
				},
				async () => {
					const batchPromises = batch.map(async (site) => {
						try {
							const siteUrl = typeof site === 'string' ? site : site.url;
              const customStyle = typeof site === 'string' ? undefined : [
                {
                  content: site.requestBody?.addStyleTag
                }
              ];

							const requestBody: any = {
								url: siteUrl,
								screenshotOptions: {
									fullPage: true,
								},
								viewport: {
									width: 1740,
									height: 1008,
								},
								gotoOptions: {
									waitUntil: 'networkidle0',
									timeout: 60000,
								},
							};

							if (customStyle) {
								requestBody.addStyleTag = customStyle;
							}

							const response = await fetch(`${apiUrl}/apps/capture-screenshot`, {
								method: 'POST',
								headers: {
									'Content-Type': 'application/json',
									Authorization: `Bearer ${apiKey}`,
								},
								body: JSON.stringify(requestBody),
							});

							if (!response.ok) {
								const errorText = await response.text();
								throw new Error(`Failed to capture screenshot for ${siteUrl}: ${errorText}`);
							}

							const result = await response.json();
							return {
								site: siteUrl,
								status: 'success',
								data: result.data,
								timestamp: new Date().toISOString(),
							};
						} catch (error) {
							return {
								site: typeof site === 'string' ? site : site.url,
								status: 'error',
								error: error.message,
								timestamp: new Date().toISOString(),
							};
						}
					});

					return Promise.all(batchPromises);
				},
			);

			results.push(...batchResults);

			if (i + batchSize < sitesToSnapshot.length) {
				await step.sleep(`wait-between-batches-${Math.floor(i / batchSize) + 1}`, '5 seconds');
			}
		}

		const summary = await step.do('summarize-results', async () => {
			const successful = results.filter((r) => r.status === 'success').length;
			const failed = results.filter((r) => r.status === 'error').length;

			return {
				totalSites: sitesToSnapshot.length,
				successful,
				failed,
				completionTime: new Date().toISOString(),
				startTime: startInfo.startTime,
				duration: `${(new Date().getTime() - new Date(startInfo.startTime).getTime()) / 1000} seconds`,
				results,
			};
		});

		return summary;
	}
}

export default {
	async fetch(request: Request, env: Env) {
    try {
      const headers = request.headers;

      if (headers.get('Authorization') !== `Bearer ${env.ASSISTANT_API_KEY}`) {
        return Response.json(
          {
            status: 'error',
            message: 'Invalid API key',
          },
        );
      }

      const instanceId = new URL(request.url).searchParams.get('workflowId');

			if (!env.NEWS_SNAPSHOTTER) {
				return Response.json(
					{
						status: 'error',
						message: 'News snapshotter workflow not found',
					},
					{ status: 404 },
				);
			}

			if (instanceId) {
				const workflowInstance = await env.NEWS_SNAPSHOTTER.get(instanceId);

				return Response.json({
					status: 'success',
					message: 'News snapshotter workflow status',
					workflowStatus: await workflowInstance.status(),
				});
			}

			let sites: string[] | undefined;

			try {
				const contentType = request.headers.get('content-type');
				if (contentType && contentType.includes('application/json')) {
					const body = await request.json();
					sites = body.sites;
				}
			} catch (e) {
				console.error('Error parsing request body:', e);
			}

      const workflowInstance = await env.NEWS_SNAPSHOTTER.create({
        params: {
          sites,
          apiUrl: env.ASSISTANT_API_URL,
          apiKey: env.ASSISTANT_API_KEY,
        }
			});

			return Response.json({
				status: 'success',
				message: 'News snapshotter workflow triggered',
				workflowId: workflowInstance.id,
				workflowStatus: await workflowInstance.status(),
			});
		} catch (error) {
			console.error('Error triggering workflow:', error);

			return Response.json(
				{
					status: 'error',
					message: error.message || 'Unknown error',
				},
				{ status: 400 },
			);
		}
	},
};
