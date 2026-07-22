import assert from "node:assert/strict";
import test from "node:test";

import { canJoinRecentStory, canJoinStory, storySlug } from "./clustering.ts";

test("automatic membership requires similarity, time compatibility, and semantic overlap", () => {
	const candidate = {
		candidateCapturedAt: "2026-07-20T08:00:00.000Z",
		candidateEntities: ["Bank of England"],
		candidateLabel: "Bank of England holds interest rates",
		capturedAt: "2026-07-20T09:00:00.000Z",
		entities: ["Bank of England", "Andrew Bailey"],
		label: "Interest rates held by Bank of England",
		similarity: 0.94,
	};

	assert.equal(canJoinStory(candidate), true);
	assert.equal(canJoinStory({ ...candidate, similarity: 0.89 }), false);
	assert.equal(canJoinStory({ ...candidate, capturedAt: "2026-07-22T09:00:00.000Z" }), false);
	assert.equal(
		canJoinStory({
			...candidate,
			candidateEntities: ["NHS England"],
			candidateLabel: "Hospitals announce winter plan",
		}),
		false,
	);
	assert.equal(
		canJoinStory({
			...candidate,
			candidateEntities: ["Bank of England"],
			candidateLabel: "Bank of England unveils new banknote design",
		}),
		false,
	);
});

test("recent persisted evidence bridges Vectorize propagation without merging distinct events", () => {
	const candidate = {
		candidateCapturedAt: "2026-07-19T17:04:59.000Z",
		candidateEntities: ["Spain", "Argentina", "World Cup"],
		candidateLabel: "Spain wins World Cup against Argentina",
		capturedAt: "2026-07-19T17:05:00.000Z",
		entities: ["Spain", "Argentina", "World Cup"],
		label: "Spain winning the World Cup final against Argentina",
	};

	assert.equal(canJoinRecentStory(candidate), true);
	assert.equal(
		canJoinRecentStory({
			...candidate,
			candidateEntities: ["Andrew Tate"],
			candidateLabel: "Andrew Tate extradition hearing begins",
			entities: ["Andrew Tate"],
			label: "Andrew Tate and brother arrested in US after UK charges",
		}),
		false,
	);
	assert.equal(
		canJoinRecentStory({
			...candidate,
			candidateEntities: ["Andy Burnham"],
			candidateLabel: "Andy Burnham appoints health secretary",
			entities: ["Andy Burnham"],
			label: "Andy Burnham scraps digital ID policy",
		}),
		false,
	);
	assert.equal(canJoinRecentStory({ ...candidate, capturedAt: "2026-07-21T06:05:00.000Z" }), false);
});

test("story slugs are readable, bounded, and identity-stable", () => {
	assert.equal(
		storySlug("Bank of England holds interest rates", "12345678-abcd"),
		"bank-of-england-holds-interest-rates-12345678",
	);
});
