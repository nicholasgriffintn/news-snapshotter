import assert from 'node:assert/strict';
import test from 'node:test';

import { storeCaptureFailure } from './capture-failures.ts';

const failure = {
	capturedAt: '2026-07-16T10:20:30.123Z',
	device: 'mobile',
	message: 'x'.repeat(600),
	reason: 'captcha',
	site: {
		brand: 'bbc',
		category: 'news',
		name: 'BBC Home',
		url: 'https://bbc.co.uk',
	},
};

test('stores a partitioned, expiring failure record with bounded messages', async () => {
	const writes = [];
	const env = { CAPTURE_FAILURES: { put: async (...args) => writes.push(args) } };

	const key = await storeCaptureFailure(env, failure);

	assert.equal(
		key,
		'failures/date=2026-07-16/2026-07-16T10-20-30-123Z-bbc-home-mobile.json',
	);
	assert.equal(writes.length, 1);
	const [storedKey, value, options] = writes[0];
	assert.equal(storedKey, key);
	assert.equal(JSON.parse(value).message.length, 500);
	assert.equal(options.expirationTtl, 90 * 24 * 60 * 60);
	assert.deepEqual(options.metadata, { brand: 'bbc', device: 'mobile', reason: 'captcha' });
});

test('returns undefined when KV persistence fails', async (context) => {
	context.mock.method(console, 'error', () => undefined);
	const env = {
		CAPTURE_FAILURES: {
			put: async () => Promise.reject(new Error('KV unavailable')),
		},
	};

	assert.equal(await storeCaptureFailure(env, failure), undefined);
});
