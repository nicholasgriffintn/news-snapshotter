import type { CaptureFailure, CatalogueSite, Snapshot } from '../types';

async function readJson<T>(response: Response): Promise<T> {
	const body = (await response.json()) as T & { message?: string };
	if (!response.ok) {
		throw new Error(body.message ?? `Request failed with ${response.status}`);
	}
	return body;
}

export async function fetchSnapshots(): Promise<Snapshot[]> {
	const response = await fetch('/api/screenshots');
	return (await readJson<{ screenshots: Snapshot[] }>(response)).screenshots;
}

export async function fetchCatalogue(): Promise<CatalogueSite[]> {
	const response = await fetch('/api/catalogue');
	return (await readJson<{ sites: CatalogueSite[] }>(response)).sites;
}

export async function startSnapshotWorkflow(
	apiKey: string,
	selection: { brand?: string; name?: string },
): Promise<{ workflowId: string; selectedSites: CatalogueSite[] }> {
	const response = await fetch('/api/workflows', {
		method: 'POST',
		headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
		body: JSON.stringify(selection),
	});
	return readJson(response);
}

export async function fetchCaptureProfiles(): Promise<string[]> {
	const response = await fetch('/api/capture-profiles');
	return (await readJson<{ profiles: string[] }>(response)).profiles;
}

export async function fetchCaptureFailures(
	apiKey: string,
	cursor?: string,
): Promise<{ cursor?: string; failures: CaptureFailure[]; hasMore: boolean }> {
	const search = new URLSearchParams({ limit: '50' });
	if (cursor) search.set('cursor', cursor);
	const response = await fetch(`/api/admin/failures?${search}`, {
		headers: { authorization: `Bearer ${apiKey}` },
	});
	return readJson(response);
}

export type BotCheckResult = {
	capturedAt: string;
	profile: string;
	results: Array<{
		device: 'desktop' | 'mobile';
		error?: string;
		fullImageUrl?: string;
		key?: string;
		status: 'error' | 'success';
		thumbnailUrl?: string;
	}>;
	url: string;
};

export async function startBotCheck(apiKey: string, profile: string): Promise<BotCheckResult> {
	const response = await fetch('/api/admin/bot-checks', {
		body: JSON.stringify({ profile }),
		headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
		method: 'POST',
	});
	return readJson(response);
}

export async function sendContactMessage(message: {
	email: string;
	message: string;
	name: string;
	reason: 'general' | 'privacy' | 'rights-holder';
	sourceUrl?: string;
	startedAt: number;
	website: string;
}): Promise<void> {
	const response = await fetch('/api/contact', {
		body: JSON.stringify(message),
		headers: { 'content-type': 'application/json' },
		method: 'POST',
	});
	await readJson(response);
}
