import assert from 'node:assert/strict';
import test from 'node:test';

import puppeteer from '@cloudflare/puppeteer';

import { captureDevice } from './browser-rendering.ts';

const site = {
	brand: 'example',
	category: 'news',
	name: 'example-home',
	url: 'https://example.com',
};
const capturedAt = '2026-07-16T10:20:30.123Z';

function successfulPage() {
	let evaluation = 0;
	return {
		$: async () => null,
		addStyleTag: async () => undefined,
		evaluate: async () => {
			evaluation += 1;
			return evaluation === 1
				? ''
				: JSON.stringify({ bodyHeight: 2_000, images: 2, textLength: 500 });
		},
		goto: async () => ({ status: () => 200 }),
		screenshot: async (options) =>
			options.fullPage ? Buffer.from('full screenshot') : Buffer.from('thumbnail'),
		setCookie: async () => undefined,
		setJavaScriptEnabled: async () => undefined,
		setUserAgent: async () => undefined,
		setViewport: async () => undefined,
		waitForFunction: async () => undefined,
	};
}

function environment() {
	const failures = [];
	const screenshots = [];
	return {
		env: {
			BROWSER: {},
			CAPTURE_FAILURES: { put: async (...args) => failures.push(args) },
			SCREENSHOTS: { put: async (...args) => screenshots.push(args) },
		},
		failures,
		screenshots,
	};
}

test('captures full and thumbnail images with metadata and closes the browser', async (context) => {
	const page = successfulPage();
	let closed = false;
	context.mock.method(puppeteer, 'launch', async () => ({
		close: async () => {
			closed = true;
		},
		newPage: async () => page,
	}));
	const { env, failures, screenshots } = environment();

	const result = await captureDevice(env, site, 'desktop', capturedAt);

	assert.equal(result.status, 'success');
	assert.match(result.key, /brand=example\/category=news\/date=2026-07-16/);
	assert.equal(screenshots.length, 2);
	assert.match(screenshots[0][0], /-thumbnail\.jpg$/);
	assert.equal(screenshots[1][2].customMetadata.name, 'example-home');
	assert.equal(failures.length, 0);
	assert.equal(closed, true);
});

test('records HTTP capture failures without retrying or writing screenshots', async (context) => {
	let closed = false;
	context.mock.method(puppeteer, 'launch', async () => ({
		close: async () => {
			closed = true;
		},
		newPage: async () => ({
			goto: async () => ({ status: () => 503 }),
			setJavaScriptEnabled: async () => undefined,
			setUserAgent: async () => undefined,
			setViewport: async () => undefined,
		}),
	}));
	const { env, failures, screenshots } = environment();

	const result = await captureDevice(env, site, 'desktop', capturedAt);

	assert.equal(result.status, 'error');
	assert.equal(result.error, 'Navigation returned HTTP 503');
	assert.match(result.failureKey, /^failures\/date=2026-07-16\//);
	assert.equal(failures.length, 1);
	assert.equal(JSON.parse(failures[0][1]).reason, 'http-error');
	assert.equal(screenshots.length, 0);
	assert.equal(closed, true);
});

test('records launch errors as capture failures', async (context) => {
	context.mock.method(puppeteer, 'launch', async () => Promise.reject(new Error('browser unavailable')));
	const { env, failures } = environment();

	const result = await captureDevice(env, site, 'mobile', capturedAt);

	assert.equal(result.status, 'error');
	assert.equal(result.error, 'browser unavailable');
	assert.equal(JSON.parse(failures[0][1]).reason, 'capture-error');
});
