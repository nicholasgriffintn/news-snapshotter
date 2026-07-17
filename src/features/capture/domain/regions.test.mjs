import assert from "node:assert/strict";
import test from "node:test";

import { CAPTURE_REGIONS } from "./regions.ts";

test("configures UK captures with London browser signals", () => {
	assert.equal(CAPTURE_REGIONS.uk.acceptLanguage, "en-GB,en;q=0.9");
	assert.equal(CAPTURE_REGIONS.uk.timezone, "Europe/London");
	assert.deepEqual(CAPTURE_REGIONS.uk.geolocation, {
		accuracy: 20,
		latitude: 51.5074,
		longitude: -0.1278,
	});
});

test("configures US captures with New York browser signals", () => {
	assert.equal(CAPTURE_REGIONS.us.acceptLanguage, "en-US,en;q=0.9");
	assert.equal(CAPTURE_REGIONS.us.timezone, "America/New_York");
	assert.deepEqual(CAPTURE_REGIONS.us.geolocation, {
		accuracy: 20,
		latitude: 40.7128,
		longitude: -74.006,
	});
});

test("keeps international captures neutral", () => {
	assert.equal(CAPTURE_REGIONS.international.acceptLanguage, "en;q=0.9");
	assert.equal(CAPTURE_REGIONS.international.timezone, "UTC");
	assert.equal(CAPTURE_REGIONS.international.geolocation, undefined);
});
