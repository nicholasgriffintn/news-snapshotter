import assert from 'node:assert/strict';
import test from 'node:test';

import { handleRequest } from './api.ts';

function environment(overrides = {}) {
	return {
		API_KEY: 'secret',
		NEWS_SNAPSHOTTER: {
			create: async () => ({ id: 'workflow-123', status: async () => ({ status: 'queued' }) }),
			get: async () => ({ status: async () => ({ status: 'running' }) }),
		},
		SCREENSHOTS: {
			list: async () => ({ objects: [], truncated: false }),
		},
		...overrides,
	};
}

function apiRequest(path, init = {}) {
	return new Request(`https://archive.example${path}`, init);
}

test('serves the public site catalogue without authentication', async () => {
	const response = await handleRequest(apiRequest('/api/catalogue'), environment());
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.ok(body.sites.length > 0);
	assert.deepEqual(Object.keys(body.sites[0]).sort(), ['brand', 'category', 'name']);
});

test('serves the public screenshot listing', async () => {
	const response = await handleRequest(apiRequest('/api/screenshots'), environment());
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.deepEqual(body, { screenshots: [], truncated: false });
});

test('lists the supported capture profiles', async () => {
	const response = await handleRequest(apiRequest('/api/capture-profiles'), environment());
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.ok(body.profiles.includes('default'));
	assert.ok(body.profiles.includes('bbc'));
});

test('protects bot checks with the configured API key', async () => {
	const response = await handleRequest(
		apiRequest('/api/admin/bot-checks', {
			body: JSON.stringify({ profile: 'default' }),
			headers: { 'content-type': 'application/json' },
			method: 'POST',
		}),
		environment(),
	);

	assert.equal(response.status, 401);
});

test('rejects unknown bot-check profiles before opening a browser', async (context) => {
	context.mock.method(console, 'error', () => undefined);
	const response = await handleRequest(
		apiRequest('/api/admin/bot-checks', {
			body: JSON.stringify({ profile: 'untrusted' }),
			headers: { authorization: 'Bearer secret', 'content-type': 'application/json' },
			method: 'POST',
		}),
		environment(),
	);

	assert.equal(response.status, 400);
	assert.equal((await response.json()).message, 'Choose a valid capture profile');
});

test('protects workflow routes with the configured API key', async () => {
	const response = await handleRequest(apiRequest('/api/workflows', { method: 'POST' }), environment());

	assert.equal(response.status, 401);
	assert.equal((await response.json()).message, 'Invalid API key');
});

test('starts a workflow for a valid named site selection', async () => {
	const creations = [];
	const env = environment({
		NEWS_SNAPSHOTTER: {
			create: async (options) => {
				creations.push(options);
				return { id: 'workflow-123', status: async () => ({ status: 'queued' }) };
			},
		},
	});
	const response = await handleRequest(
		apiRequest('/api/workflows', {
			body: JSON.stringify({ name: 'bbc-home' }),
			headers: { authorization: 'Bearer secret', 'content-type': 'application/json' },
			method: 'POST',
		}),
		env,
	);
	const body = await response.json();

	assert.equal(response.status, 202);
	assert.equal(body.workflowId, 'workflow-123');
	assert.equal(creations[0].params.sites.length, 1);
	assert.equal(creations[0].params.sites[0].name, 'bbc-home');
});

test('returns workflow status by identifier', async () => {
	const response = await handleRequest(
		apiRequest('/api/workflows/workflow-123', {
			headers: { authorization: 'Bearer secret' },
		}),
		environment(),
	);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.workflowId, 'workflow-123');
	assert.deepEqual(body.workflowStatus, { status: 'running' });
});

test('turns invalid workflow selections into a 400 response', async (context) => {
	context.mock.method(console, 'error', () => undefined);
	const response = await handleRequest(
		apiRequest('/api/workflows', {
			body: JSON.stringify({ brand: 'bbc', name: 'bbc-home' }),
			headers: { authorization: 'Bearer secret', 'content-type': 'application/json' },
			method: 'POST',
		}),
		environment(),
	);

	assert.equal(response.status, 400);
	assert.match((await response.json()).message, /either brand or name/);
});

test('returns 404 for an unknown authorised API route', async () => {
	const response = await handleRequest(
		apiRequest('/api/missing', { headers: { authorization: 'Bearer secret' } }),
		environment(),
	);

	assert.equal(response.status, 404);
});
