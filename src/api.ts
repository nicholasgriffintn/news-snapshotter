import { SITES } from './constants.ts';
import { runBotCheck } from './bot-check.ts';
import { listCaptureFailures } from './capture-failures.ts';
import { CAPTURE_PROFILE_NAMES, hasCaptureProfile } from './capture-profiles.ts';
import { sendContactMessage } from './contact.ts';
import type { Env } from './env';
import { isAuthorised } from './lib/auth.ts';
import { errorMessage } from './lib/errors.ts';
import { selectSites, type SiteSelection } from './lib/site-catalogue.ts';
import { thumbnailKey } from './lib/storage-key.ts';
import { listScreenshots, screenshotImageUrl, serveScreenshot } from './snapshots.ts';

function jsonError(message: string, status: number): Response {
	return Response.json({ status: 'error', message }, { status });
}

async function parseSelection(request: Request): Promise<SiteSelection> {
	if (!request.headers.get('content-type')?.includes('application/json')) {
		return {};
	}

	const body: unknown = await request.json();

	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		throw new Error('Request body must be a JSON object');
	}

	const { brand, name } = body as Record<string, unknown>;

	if (brand !== undefined && (typeof brand !== 'string' || brand.length === 0)) {
		throw new Error('brand must be a non-empty string');
	}
	if (name !== undefined && (typeof name !== 'string' || name.length === 0)) {
		throw new Error('name must be a non-empty string');
	}

	return { brand: brand as string | undefined, name: name as string | undefined };
}

async function startWorkflow(request: Request, env: Env): Promise<Response> {
	const sites = selectSites(SITES, await parseSelection(request));
	const instance = await env.NEWS_SNAPSHOTTER.create({ params: { capturedAt: new Date().toISOString(), sites } });

	return Response.json(
		{
			status: 'success',
			selectedSites: sites.map(({ brand, category, name }) => ({ brand, category, name })),
			workflowId: instance.id,
			workflowStatus: await instance.status(),
		},
		{ status: 202 },
	);
}

async function startBotCheck(request: Request, env: Env): Promise<Response> {
	const body: unknown = await request.json();
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		throw new Error('Bot check request must be a JSON object');
	}

	const { profile } = body as Record<string, unknown>;
	if (typeof profile !== 'string' || !hasCaptureProfile(profile)) {
		throw new Error('Choose a valid capture profile');
	}

	const result = await runBotCheck(env, profile);
	return Response.json({
		status: 'success',
		...result,
		results: result.results.map((capture) => {
			return capture.key
				? {
						...capture,
						fullImageUrl: screenshotImageUrl(capture.key),
						thumbnailUrl: screenshotImageUrl(thumbnailKey(capture.key)),
					}
				: capture;
		}),
	});
}

function failureListOptions(url: URL): { cursor?: string; limit: number } {
	const cursor = url.searchParams.get('cursor') ?? undefined;
	const limitValue = url.searchParams.get('limit');
	const limit = limitValue === null ? 50 : Number(limitValue);
	if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
		throw new Error('limit must be between 1 and 100');
	}
	if (cursor !== undefined && (cursor.length === 0 || cursor.length > 1_024)) {
		throw new Error('cursor is invalid');
	}
	return { cursor, limit };
}

async function routeRequest(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);

	if (request.method === 'GET' && url.pathname === '/api/screenshots') {
		return Response.json(await listScreenshots(env.SCREENSHOTS));
	}

	if (request.method === 'GET' && url.pathname === '/api/screenshots/image') {
		return serveScreenshot(request, env);
	}

	if (request.method === 'GET' && url.pathname === '/api/catalogue') {
		return Response.json({ sites: SITES.map(({ brand, category, name }) => ({ brand, category, name })) });
	}

	if (request.method === 'GET' && url.pathname === '/api/capture-profiles') {
		return Response.json({ profiles: CAPTURE_PROFILE_NAMES });
	}

	if (request.method === 'POST' && url.pathname === '/api/contact') {
		return sendContactMessage(request, env);
	}

	if (!isAuthorised(request.headers.get('authorization'), env.API_KEY)) {
		return jsonError('Invalid API key', 401);
	}

	if (request.method === 'POST' && url.pathname === '/api/workflows') {
		return startWorkflow(request, env);
	}

	if (request.method === 'POST' && url.pathname === '/api/admin/bot-checks') {
		return startBotCheck(request, env);
	}

	if (request.method === 'GET' && url.pathname === '/api/admin/failures') {
		return Response.json(await listCaptureFailures(env, failureListOptions(url)));
	}

	if (request.method === 'GET' && url.pathname.startsWith('/api/workflows/')) {
		const workflowId = url.pathname.slice('/api/workflows/'.length);
		if (!workflowId) {
			return jsonError('Workflow ID is required', 400);
		}
		const instance = await env.NEWS_SNAPSHOTTER.get(workflowId);
		return Response.json({ status: 'success', workflowId, workflowStatus: await instance.status() });
	}

	return jsonError('Not found', 404);
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
	try {
		return await routeRequest(request, env);
	} catch (error) {
		console.error('Request failed', { error: errorMessage(error) });
		return jsonError(errorMessage(error), 400);
	}
}
