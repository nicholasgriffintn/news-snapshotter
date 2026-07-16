import type { CatalogueSite, Snapshot } from '../types';

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
