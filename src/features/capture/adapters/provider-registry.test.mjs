import assert from "node:assert/strict";
import test from "node:test";

import puppeteer from "@cloudflare/puppeteer";

import {
	captureProviderManagesFingerprint,
	connectToRemoteBrowser,
	createHyperbrowserClient,
	hasCaptureProvider,
	openCaptureBrowser,
	openHyperbrowserCaptureBrowser,
} from "./provider-registry.ts";

test("connects to remote browsers with the runtime's native WebSocket", async () => {
	const transport = {
		close: () => {},
		send: () => {},
	};
	let receivedOptions;
	const browser = {};

	const result = await connectToRemoteBrowser(
		"wss://session.example",
		async (options) => {
			receivedOptions = options;
			return browser;
		},
		async (endpoint) => {
			assert.equal(endpoint, "wss://session.example");
			return transport;
		},
	);

	assert.equal(result, browser);
	assert.deepEqual(receivedOptions, {
		defaultViewport: null,
		transport,
	});
	assert.equal(receivedOptions.browserWSEndpoint, undefined);
});

test("preserves fingerprints managed by remote stealth providers", () => {
	assert.equal(captureProviderManagesFingerprint("cloudflare"), false);
	assert.equal(captureProviderManagesFingerprint("hyperbrowser"), true);
});

test("uses the Worker fetch API for Hyperbrowser session lifecycle", async () => {
	const requests = [];
	const client = createHyperbrowserClient("secret-key", async (input, init) => {
		requests.push({ input, init });
		if (init.method === "PUT") {
			return new Response(null, { status: 204 });
		}

		return Response.json({
			id: "session-123",
			wsEndpoint: "wss://session.example",
		});
	});
	const session = await client.sessions.create({ useStealth: true });
	await client.sessions.stop(session.id);

	assert.equal(requests[0].input, "https://api.hyperbrowser.ai/api/session");
	assert.equal(requests[0].init.method, "POST");
	assert.equal(requests[0].init.headers["x-api-key"], "secret-key");
	assert.deepEqual(JSON.parse(requests[0].init.body), {
		useStealth: true,
	});
	assert.equal(requests[1].input, "https://api.hyperbrowser.ai/api/session/session-123/stop");
	assert.equal(requests[1].init.method, "PUT");
});

test("reports Hyperbrowser API errors without exposing credentials", async () => {
	const client = createHyperbrowserClient("do-not-expose", async () =>
		Response.json({ message: "Invalid session configuration" }, { status: 400 }),
	);

	await assert.rejects(client.sessions.create({ useStealth: true }), (error) => {
		assert.match(error.message, /Invalid session configuration/);
		assert.doesNotMatch(error.message, /do-not-expose/);
		return true;
	});
});

function providerContext(captureRegion = "uk", device = "desktop") {
	return {
		config: {
			viewport:
				device === "mobile"
					? {
							height: 915,
							width: 412,
						}
					: {
							height: 1_008,
							width: 1_740,
						},
		},
		device,
		env: {
			BROWSER: {},
		},
		site: {
			brand: "example",
			captureRegion,
			category: "news",
			name: "example-home",
			priority: 1,
			url: "https://example.com",
		},
	};
}

function hyperbrowserClient(events) {
	return {
		sessions: {
			create: async (params) => {
				events.push(["create", params]);

				return {
					id: "session-123",
					wsEndpoint: "wss://session.example",
				};
			},
			stop: async (sessionId) => {
				events.push(["stop", sessionId]);
			},
		},
	};
}

test("only accepts registered capture providers", () => {
	assert.equal(hasCaptureProvider("cloudflare"), true);
	assert.equal(hasCaptureProvider("hyperbrowser"), true);
	assert.equal(hasCaptureProvider("custom-websocket"), false);
});

test("requires a configured Hyperbrowser secret", async () => {
	await assert.rejects(
		openCaptureBrowser("hyperbrowser", providerContext()),
		/Hyperbrowser provider is not configured/,
	);
});

test("closes a Cloudflare browser when page creation fails", async (context) => {
	let closed = false;
	context.mock.method(puppeteer, "launch", async () => ({
		close: async () => {
			closed = true;
		},
		newPage: async () => {
			throw new Error("page creation failed");
		},
	}));

	await assert.rejects(
		openCaptureBrowser("cloudflare", providerContext()),
		/page creation failed/,
	);
	assert.equal(closed, true);
});

test("creates and stops a regional Hyperbrowser session", async () => {
	const events = [];
	const page = {};
	const captureSession = await openHyperbrowserCaptureBrowser(
		providerContext("uk"),
		hyperbrowserClient(events),
		async (wsEndpoint) => {
			events.push(["connect", wsEndpoint]);

			return {
				defaultBrowserContext: () => ({
					pages: async () => [page],
				}),
				disconnect: () => {
					events.push(["disconnect"]);
				},
			};
		},
	);

	assert.equal(captureSession.page, page);
	assert.equal(events[0][1].proxyCountry, undefined);
	assert.equal(events[0][1].region, "europe-west");
	assert.equal(events[0][1].useProxy, false);
	assert.equal(events[0][1].useStealth, true);
	assert.equal(events[0][1].adblock, true);
	assert.equal(events[0][1].trackers, true);
	assert.deepEqual(events[0][1].device, ["desktop"]);
	assert.deepEqual(events[0][1].operatingSystems, ["macos"]);
	assert.deepEqual(events[0][1].platform, ["chrome"]);
	assert.deepEqual(events[0][1].screen, {
		height: 1_008,
		width: 1_740,
	});
	await captureSession.close();
	assert.deepEqual(events.slice(1), [
		["connect", "wss://session.example"],
		["disconnect"],
		["stop", "session-123"],
	]);
});

test("configures mobile Hyperbrowser sessions as Android Chrome", async () => {
	const events = [];
	const captureSession = await openHyperbrowserCaptureBrowser(
		providerContext("us", "mobile"),
		hyperbrowserClient(events),
		async () => ({
			defaultBrowserContext: () => ({
				pages: async () => [{}],
			}),
			disconnect: () => {},
		}),
	);

	assert.equal(events[0][1].proxyCountry, undefined);
	assert.equal(events[0][1].region, "us-east");
	assert.equal(events[0][1].useProxy, false);
	assert.deepEqual(events[0][1].device, ["mobile"]);
	assert.deepEqual(events[0][1].operatingSystems, ["android"]);
	assert.deepEqual(events[0][1].platform, ["chrome"]);
	assert.deepEqual(events[0][1].screen, {
		height: 915,
		width: 500,
	});

	await captureSession.close();
});

test("stops Hyperbrowser when the WebSocket connection fails", async () => {
	const events = [];

	await assert.rejects(
		openHyperbrowserCaptureBrowser(
			providerContext("international"),
			hyperbrowserClient(events),
			async () => {
				throw new Error("connection failed");
			},
		),
		/connection failed/,
	);
	assert.deepEqual(events.at(-1), ["stop", "session-123"]);
	assert.equal(events[0][1].useProxy, false);
});
