import assert from 'node:assert/strict';
import test from 'node:test';

import { runSnapshotWorkflow } from './workflow-runner.ts';

const capturedAt = '2026-07-16T10:20:30.123Z';
const sites = [
	{ brand: 'bbc', category: 'news', name: 'bbc-home', url: 'https://bbc.co.uk' },
	{ brand: 'sky', category: 'sport', name: 'sky-sports', url: 'https://skysports.com' },
];

test('runs one durable step per site and device and aggregates results', async () => {
	const stepNames = [];
	const captures = [];
	const step = {
		do: async (name, callback) => {
			stepNames.push(name);
			return callback();
		},
	};
	const capture = async (_env, site, device, timestamp) => {
		captures.push({ device, name: site.name, timestamp });
		return device === 'desktop'
			? { device, key: `${site.name}-${device}.png`, name: site.name, status: 'success' }
			: { device, error: 'mobile failed', name: site.name, status: 'error' };
	};

	const result = await runSnapshotWorkflow({}, { capturedAt, sites }, step, capture);

	assert.equal(result.totalSites, 2);
	assert.equal(result.totalCaptures, 4);
	assert.equal(result.successful, 2);
	assert.equal(result.failed, 2);
	assert.deepEqual(stepNames, [
		'screenshot-bbc-home-desktop',
		'screenshot-bbc-home-mobile',
		'screenshot-sky-sports-desktop',
		'screenshot-sky-sports-mobile',
	]);
	assert.ok(captures.every(({ timestamp }) => timestamp === capturedAt));
});

test('returns an empty summary when no sites are selected', async () => {
	const step = { do: async (_name, callback) => callback() };
	const result = await runSnapshotWorkflow({}, { capturedAt, sites: [] }, step, async () => {
		throw new Error('capture should not run');
	});

	assert.deepEqual(result, {
		capturedAt,
		failed: 0,
		results: [],
		successful: 0,
		totalCaptures: 0,
		totalSites: 0,
	});
});

test('does not retry or swallow a durable step failure', async () => {
	let attempts = 0;
	const step = {
		do: async () => {
			attempts += 1;
			throw new Error('step unavailable');
		},
	};

	await assert.rejects(
		() => runSnapshotWorkflow({}, { capturedAt, sites: [sites[0]] }, step, async () => undefined),
		/step unavailable/,
	);
	assert.equal(attempts, 1);
});
