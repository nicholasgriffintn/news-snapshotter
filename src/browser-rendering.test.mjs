import assert from 'node:assert/strict';
import test from 'node:test';

import puppeteer from '@cloudflare/puppeteer';

import { captureDevice } from './browser-rendering.ts';

const site = {
	brand: 'example',
	category: 'news',
	name: 'example-home',
	runtimeQuietMs: 0,
	url: 'https://example.com',
};
const capturedAt = '2026-07-16T10:20:30.123Z';

function successfulPage(overrides = {}) {
	let evaluation = 0;
	const profileCalls = [];
	const runtimeCalls = [];
	return {
		$: async () => null,
		_client: () => ({ send: async (method) => runtimeCalls.push(method) }),
		addStyleTag: async () => undefined,
		evaluateOnNewDocument: async (...args) => profileCalls.push(['evaluateOnNewDocument', ...args]),
		evaluate: async () => {
			evaluation += 1;
			return evaluation === 1
				? ''
				: JSON.stringify({ bodyHeight: 2_000, images: 2, textLength: 500 });
		},
		goto: async () => ({ status: () => 200 }),
		screenshot: async (options) =>
			options.fullPage ? Buffer.from('full screenshot') : Buffer.from('thumbnail'),
		profileCalls,
		runtimeCalls,
		setCookie: async () => undefined,
		setExtraHTTPHeaders: async (...args) => profileCalls.push(['setExtraHTTPHeaders', ...args]),
		setJavaScriptEnabled: async () => undefined,
		setUserAgent: async (...args) => profileCalls.push(['setUserAgent', ...args]),
		setViewport: async () => undefined,
		waitForFunction: async () => undefined,
		...overrides,
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
	assert.equal(screenshots[1][2].customMetadata.visibility, 'public');
	assert.equal(failures.length, 0);
	assert.equal(closed, true);
	assert.ok(page.profileCalls.some(([method]) => method === 'setExtraHTTPHeaders'));
	assert.ok(page.profileCalls.some(([method]) => method === 'evaluateOnNewDocument'));
	const userAgentCall = page.profileCalls.find(([method]) => method === 'setUserAgent');
	assert.match(userAgentCall[1], /Macintosh/);
	assert.equal(userAgentCall[2].platform, 'macOS');
	assert.deepEqual(page.runtimeCalls, ['Runtime.disable', 'Runtime.enable']);
});

test('records HTTP capture failures without retrying or writing screenshots', async (context) => {
	let closed = false;
	context.mock.method(puppeteer, 'launch', async () => ({
		close: async () => {
			closed = true;
		},
		newPage: async () => ({
			_client: () => ({ send: async () => undefined }),
			evaluateOnNewDocument: async () => undefined,
			goto: async () => ({ status: () => 503 }),
			setExtraHTTPHeaders: async () => undefined,
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

test('waits for configured completion text before storing a capture', async (context) => {
	const completionWaits = [];
	const page = successfulPage({
		waitForFunction: async (_predicate, options, ...args) => {
			if (args.length > 0) completionWaits.push({ args, options });
		},
	});
	context.mock.method(puppeteer, 'launch', async () => ({
		close: async () => undefined,
		newPage: async () => page,
	}));
	const { env, screenshots } = environment();
	const completion = {
		selector: '#status',
		textStartsWith: 'Classification:',
		timeoutMs: 30_000,
	};

	const result = await captureDevice(env, { ...site, completion }, 'desktop', capturedAt);

	assert.equal(result.status, 'success');
	assert.deepEqual(completionWaits, [
		{ args: ['#status', 'Classification:'], options: { timeout: 30_000 } },
	]);
	assert.equal(screenshots.length, 2);
});

test('records a completion timeout without storing a partial screenshot', async (context) => {
	const page = successfulPage({
		waitForFunction: async (_predicate, _options, ...args) => {
			if (args.length > 0) throw new Error('timeout');
		},
	});
	context.mock.method(puppeteer, 'launch', async () => ({
		close: async () => undefined,
		newPage: async () => page,
	}));
	const { env, failures, screenshots } = environment();
	const completion = {
		selector: '#status',
		textStartsWith: 'Classification:',
		timeoutMs: 30_000,
	};

	const result = await captureDevice(env, { ...site, completion }, 'desktop', capturedAt);

	assert.equal(result.status, 'error');
	assert.equal(result.error, 'Page did not complete within 30000ms');
	assert.equal(JSON.parse(failures[0][1]).reason, 'completion-timeout');
	assert.equal(screenshots.length, 0);
});
