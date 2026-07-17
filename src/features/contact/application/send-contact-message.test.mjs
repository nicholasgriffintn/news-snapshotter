import assert from "node:assert/strict";
import test from "node:test";

import { sendContactMessage } from "./send-contact-message.ts";

const NOW = new Date("2026-07-16T12:00:00.000Z").getTime();

function contactBody(overrides = {}) {
	return {
		email: "reader@example.com",
		message: "This is a sufficiently detailed archive enquiry.",
		name: "Archive Reader",
		reason: "general",
		startedAt: NOW - 5_000,
		website: "",
		...overrides,
	};
}

function request(body) {
	return new Request("https://archive.example/api/contact", {
		body: JSON.stringify(body),
		headers: { "content-type": "application/json" },
		method: "POST",
	});
}

function environment(overrides = {}) {
	const sent = [];
	return {
		env: {
			CONTACT_EMAIL: { send: async (message) => sent.push(message) },
			CONTACT_RATE_LIMIT: { limit: async () => ({ success: true }) },
			...overrides,
		},
		sent,
	};
}

test("valid contact requests are rate-limited and delivered", async (context) => {
	context.mock.method(Date, "now", () => NOW);
	const { env, sent } = environment();

	const response = await sendContactMessage(request(contactBody()), env);

	assert.equal(response.status, 200);
	assert.equal(sent.length, 1);
	assert.equal(sent[0].to, "pashi@nicholasgriffin.dev");
	assert.match(sent[0].text, /Email: reader@example\.com/);
	assert.match(sent[0].text, /sufficiently detailed archive enquiry/);
});

test("source URLs are included in delivered messages", async (context) => {
	context.mock.method(Date, "now", () => NOW);
	const { env, sent } = environment();

	await sendContactMessage(
		request(contactBody({ sourceUrl: "https://publisher.example/story" })),
		env,
	);

	assert.match(sent[0].text, /Captured page: https:\/\/publisher\.example\/story/);
});

test("honeypot and implausibly fast submissions silently succeed without sending", async (context) => {
	context.mock.method(Date, "now", () => NOW);
	const honeypot = environment();
	const tooFast = environment();

	assert.equal(
		(await sendContactMessage(request(contactBody({ website: "spam" })), honeypot.env)).status,
		200,
	);
	assert.equal(
		(await sendContactMessage(request(contactBody({ startedAt: NOW - 100 })), tooFast.env)).status,
		200,
	);
	assert.equal(honeypot.sent.length, 0);
	assert.equal(tooFast.sent.length, 0);
});

test("rate-limited submissions return 429 without sending", async (context) => {
	context.mock.method(Date, "now", () => NOW);
	const { env, sent } = environment({
		CONTACT_RATE_LIMIT: { limit: async () => ({ success: false }) },
	});

	const response = await sendContactMessage(request(contactBody()), env);

	assert.equal(response.status, 429);
	assert.equal(sent.length, 0);
});

test("delivery failures return a service error", async (context) => {
	context.mock.method(Date, "now", () => NOW);
	context.mock.method(console, "error", () => undefined);
	const { env } = environment({
		CONTACT_EMAIL: { send: async () => Promise.reject(new Error("down")) },
	});

	const response = await sendContactMessage(request(contactBody()), env);

	assert.equal(response.status, 502);
});

test("invalid contact fields are rejected before delivery", async (context) => {
	context.mock.method(Date, "now", () => NOW);
	const { env } = environment();

	await assert.rejects(
		() => sendContactMessage(request(contactBody({ email: "invalid" })), env),
		/Enter a valid email address/,
	);
	await assert.rejects(
		() => sendContactMessage(request(contactBody({ message: "short" })), env),
		/Enter a message between 20 and 4,000 characters/,
	);
	await assert.rejects(
		() => sendContactMessage(request(contactBody({ reason: "sales" })), env),
		/Choose a valid contact reason/,
	);
});
