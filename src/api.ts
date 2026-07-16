import { SITES } from './constants';
import type { Env } from './env';
import { isAuthorised } from './lib/auth';
import { errorMessage } from './lib/errors';
import { selectSites, type SiteSelection } from './lib/site-catalogue';
import { listScreenshots, serveScreenshot } from './snapshots';

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

	if (!isAuthorised(request.headers.get('authorization'), env.API_KEY)) {
		return jsonError('Invalid API key', 401);
	}

	if (request.method === 'POST' && url.pathname === '/api/workflows') {
		return startWorkflow(request, env);
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
