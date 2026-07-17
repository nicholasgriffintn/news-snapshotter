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
const triggeredAt = '2026-07-16T10:20:30.123Z';

function successfulPage(overrides = {}) {
	let evaluation = 0;
	let scrollY = 0;
	const profileCalls = [];
	const runtimeCalls = [];
	const layoutCalls = [];
	return {
		$: async () => null,
		_client: () => ({ send: async (method) => runtimeCalls.push(method) }),
		addStyleTag: async () => undefined,
		evaluateOnNewDocument: async (...args) => profileCalls.push(['evaluateOnNewDocument', ...args]),
		evaluate: async (_callback, command) => {
			if (command?.action === 'expand-scroll-layout') {
				layoutCalls.push(command.action);
				return undefined;
			}
			if (command?.action === 'measure') {
				return { height: 2_000, viewportHeight: 1_000, y: scrollY };
			}
			if (command?.action === 'move') {
				scrollY = command.top;
				return undefined;
			}
			evaluation += 1;
			return evaluation === 1
				? ''
				: JSON.stringify({ bodyHeight: 2_000, images: 2, textLength: 500 });
		},
		frames: () => [],
		goto: async () => ({ status: () => 200 }),
		layoutCalls,
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
	const archive = [];
	const failures = [];
	const screenshots = [];
	return {
		env: {
			ARCHIVE_DATA: { put: async (...args) => archive.push(args) },
			BROWSER: {},
			CAPTURE_FAILURES: { put: async (...args) => failures.push(args) },
			SCREENSHOTS: { put: async (...args) => screenshots.push(args) },
		},
		archive,
		failures,
		screenshots,
	};
}

test('stores desktop analysis independently from screenshot artefacts', async (context) => {
	let evaluation = 0;
	let scrollY = 0;
	const elements = Array.from({ length: 20 }, (_, index) => ({
		canonicalUrl: `https://www.bbc.co.uk/news/articles/${index}`,
		elementKey: `story-${index}`,
		headline: `BBC story headline ${index}`,
		kind: 'story',
		position: {
			height: 100,
			left: 0,
			pageOrder: index + 1,
			top: index * 100,
			viewportDepth: index / 10,
			width: 500,
		},
		textFingerprint: `bbc story headline ${index}`,
	}));
	const page = successfulPage({
		evaluate: async (_callback, command) => {
			if (command?.action === 'measure') {
				return { height: 2_000, viewportHeight: 1_000, y: scrollY };
			}
			if (command?.action === 'move') {
				scrollY = command.top;
				return undefined;
			}
			if (command?.action === 'expand-scroll-layout') return undefined;

			evaluation += 1;
			if (evaluation === 1) return '';
			if (evaluation === 2) {
				return JSON.stringify({ bodyHeight: 2_000, images: 2, textLength: 500 });
			}
			return JSON.stringify({
				elements,
				html: '<!doctype html><html><body>BBC</body></html>',
				pageHeight: 2_000,
				pageWidth: 1_740,
			});
		},
	});
	context.mock.method(puppeteer, 'launch', async () => ({
		close: async () => undefined,
		newPage: async () => page,
	}));
	const { archive, env, screenshots } = environment();
	const analysedSite = {
		...site,
		analysis: {
			device: 'desktop',
			extractor: 'bbc-front-page',
			minimumElements: 20,
			version: 1,
		},
		brand: 'bbc',
		name: 'bbc-home',
	};

	const result = await captureDevice(env, analysedSite, 'desktop', triggeredAt);

	assert.equal(result.status, 'success');
	assert.equal(result.analysis.status, 'stored');
	assert.equal(archive.length, 2);
	assert.equal(screenshots.length, 2);
});

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

	const result = await captureDevice(env, site, 'desktop', triggeredAt);

	assert.equal(result.status, 'success');
	assert.match(result.key, /brand=example\/category=news\/date=2026-07-16/);
	assert.equal(screenshots.length, 2);
	assert.match(screenshots[0][0], /-thumbnail\.jpg$/);
	assert.equal(screenshots[1][2].customMetadata.name, 'example-home');
	assert.equal(screenshots[1][2].customMetadata.visibility, 'public');
	assert.equal(screenshots[1][2].customMetadata.triggeredAt, triggeredAt);
	assert.notEqual(screenshots[1][2].customMetadata.capturedAt, triggeredAt);
	assert.equal(result.capturedAt, screenshots[1][2].customMetadata.capturedAt);
	assert.equal(failures.length, 0);
	assert.equal(closed, true);
	assert.ok(page.profileCalls.some(([method]) => method === 'setExtraHTTPHeaders'));
	assert.ok(page.profileCalls.some(([method]) => method === 'evaluateOnNewDocument'));
	const userAgentCall = page.profileCalls.find(([method]) => method === 'setUserAgent');
	assert.match(userAgentCall[1], /Macintosh/);
	assert.equal(userAgentCall[2].platform, 'macOS');
	assert.deepEqual(page.runtimeCalls, ['Runtime.disable', 'Runtime.enable']);
	assert.deepEqual(page.layoutCalls, ['expand-scroll-layout']);
});

test('runs optional profile clicks before applying cleanup styles', async (context) => {
	const events = [];
	const page = successfulPage({
		addStyleTag: async () => {
			events.push('styles');
			return undefined;
		},
		waitForSelector: async (selector) => {
			if (!selector.includes('cassie-accept-all')) return null;
			return { click: async () => events.push('click') };
		},
	});
	context.mock.method(puppeteer, 'launch', async () => ({
		close: async () => undefined,
		newPage: async () => page,
	}));
	const { env } = environment();

	const result = await captureDevice(
		env,
		{ ...site, brand: 'itv', name: 'itv-home' },
		'desktop',
		triggeredAt,
	);

	assert.equal(result.status, 'success');
	assert.deepEqual(events.slice(0, 2), ['click', 'styles']);
});

test('runs consent actions inside matching iframes', async (context) => {
	const clicked = [];
	const consentFrame = {
		url: () => 'https://privacy.example/consent',
		waitForSelector: async (selector) => ({
			click: async () => clicked.push(selector),
		}),
	};
	const page = successfulPage({
		frames: () => [consentFrame],
		waitForSelector: async () => null,
	});
	context.mock.method(puppeteer, 'launch', async () => ({
		close: async () => undefined,
		newPage: async () => page,
	}));
	const { env } = environment();

	const result = await captureDevice(
		env,
		{ ...site, brand: 'financialtimes', name: 'financial-times-home' },
		'desktop',
		triggeredAt,
	);

	assert.equal(result.status, 'success');
	assert.deepEqual(clicked, ['button[title="Reject"]']);
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

	const result = await captureDevice(env, site, 'desktop', triggeredAt);

	assert.equal(result.status, 'error');
	assert.equal(result.error, 'Navigation returned HTTP 503');
	assert.match(result.failureKey, /^failures\/date=\d{4}-\d{2}-\d{2}\//);
	assert.equal(failures.length, 1);
	const failure = JSON.parse(failures[0][1]);
	assert.equal(failure.reason, 'http-error');
	assert.equal(failure.triggeredAt, triggeredAt);
	assert.notEqual(failure.capturedAt, triggeredAt);
	assert.equal(screenshots.length, 0);
	assert.equal(closed, true);
});

test('records launch errors as capture failures', async (context) => {
	context.mock.method(puppeteer, 'launch', async () => Promise.reject(new Error('browser unavailable')));
	const { env, failures } = environment();

	const result = await captureDevice(env, site, 'mobile', triggeredAt);

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

	const result = await captureDevice(env, { ...site, completion }, 'desktop', triggeredAt);

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

	const result = await captureDevice(env, { ...site, completion }, 'desktop', triggeredAt);

	assert.equal(result.status, 'error');
	assert.equal(result.error, 'Page did not complete within 30000ms');
	assert.equal(JSON.parse(failures[0][1]).reason, 'completion-timeout');
	assert.equal(screenshots.length, 0);
});
