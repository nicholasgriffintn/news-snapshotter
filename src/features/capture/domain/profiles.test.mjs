import assert from "node:assert/strict";
import test from "node:test";

import { resolveCaptureProfile } from "./profiles.ts";

function site(overrides = {}) {
	return {
		brand: "example",
		category: "news",
		name: "example-home",
		url: "https://example.com",
		...overrides,
	};
}

test("resolves safe desktop and mobile defaults", () => {
	const profile = resolveCaptureProfile(site());

	assert.deepEqual(profile.devices, ["desktop", "mobile"]);
	assert.deepEqual(profile.deviceConfig.desktop.viewport, { height: 1008, width: 1740 });
	assert.deepEqual(profile.deviceConfig.mobile.viewport, { height: 915, width: 412 });
	assert.equal(profile.deviceConfig.desktop.screenshot.fullPage, true);
	assert.match(profile.deviceConfig.desktop.userAgent, /Macintosh/);
	assert.equal(profile.deviceConfig.desktop.userAgentMetadata.platform, "macOS");
	assert.equal(profile.deviceConfig.desktop.userAgentMetadata.mobile, false);
	assert.equal(profile.deviceConfig.desktop.extraHTTPHeaders["accept-language"], "en-GB,en;q=0.9");
	assert.equal(profile.deviceConfig.desktop.hideWebdriver, true);
	assert.equal(profile.provider, "cloudflare");
	assert.ok(profile.deviceConfig.desktop.hideSelectors.includes("#onetrust-banner-sdk"));
	assert.ok(profile.deviceConfig.mobile.hideSelectors.includes(".smartbanner"));
	assert.ok(profile.deviceConfig.mobile.hideSelectors.includes('[class*="app-banner"]'));
	assert.ok(
		profile.deviceConfig.mobile.clickActions.some(({ selector }) =>
			selector.includes("#onetrust-accept-btn-handler"),
		),
	);
	assert.ok(profile.failureIndicators.some(({ reason }) => reason === "captcha"));
});

test("uses an explicit profile instead of the site brand", () => {
	const profile = resolveCaptureProfile(site({ brand: "bbc-local", profile: "bbc" }));

	assert.ok(profile.deviceConfig.desktop.cookies.some(({ name }) => name === "ckns_policy"));
	assert.ok(profile.deviceConfig.mobile.cookies.some(({ name }) => name === "ckns_explicit"));
});

test("allows a site to override its profile provider", () => {
	const profile = resolveCaptureProfile(
		site({
			provider: "hyperbrowser",
		}),
	);

	assert.equal(profile.provider, "hyperbrowser");
});

test("merges brand overrides without dropping default protection", () => {
	const profile = resolveCaptureProfile(site({ brand: "bloomberg" }));

	assert.deepEqual(profile.deviceConfig.desktop.viewport, { height: 1080, width: 1920 });
	assert.ok(profile.deviceConfig.desktop.hideSelectors.includes("#onetrust-banner-sdk"));
	assert.ok(profile.deviceConfig.desktop.blockSelectors.some(({ reason }) => reason === "captcha"));
	assert.ok(profile.deviceConfig.desktop.hideSelectors.includes("#fortress-container-root"));
	assert.ok(
		profile.deviceConfig.desktop.styles.includes(
			"html.sp-message-open { overflow: auto !important; }",
		),
	);
	assert.ok(profile.failureIndicators.some(({ reason }) => reason === "security-systems"));
});

test("carries publisher cleaning rules into both device profiles", () => {
	const bbc = resolveCaptureProfile(site({ brand: "bbc" }));
	const dailymail = resolveCaptureProfile(site({ brand: "dailymail" }));
	const guardian = resolveCaptureProfile(site({ brand: "guardian" }));
	const independent = resolveCaptureProfile(site({ brand: "independent" }));
	const newsquest = resolveCaptureProfile(site({ brand: "newsquest" }));
	const reach = resolveCaptureProfile(site({ brand: "reach" }));
	const sky = resolveCaptureProfile(site({ brand: "sky" }));
	const telegraph = resolveCaptureProfile(site({ brand: "telegraph" }));
	const times = resolveCaptureProfile(site({ brand: "times" }));
	const metro = resolveCaptureProfile(site({ brand: "metro" }));
	const nytimes = resolveCaptureProfile(site({ brand: "nytimes" }));
	assert.ok(
		bbc.deviceConfig.desktop.cookies.some((cookie) => {
			return cookie.name === "ckns_policy" && cookie.url === "https://www.bbc.com";
		}),
	);
	assert.deepEqual(bbc.deviceConfig.desktop.responseOverrides, [
		{
			body: {
				"X-Country": "gb",
				"X-Ip_is_uk_combined": "yes",
				"X-Ip_is_advertise_combined": "no",
			},
			url: "https://www.bbc.co.uk/userinfo",
		},
	]);
	assert.deepEqual(
		bbc.deviceConfig.mobile.responseOverrides,
		bbc.deviceConfig.desktop.responseOverrides,
	);
	assert.ok(
		dailymail.deviceConfig.desktop.clickActions.some((action) => {
			return action.frameUrlIncludes?.includes("cmp.dmgmediaprivacy.co.uk");
		}),
	);
	assert.equal(guardian.deviceConfig.desktop.scroll.behavior, "auto");
	assert.equal(guardian.deviceConfig.mobile.scroll.behavior, "auto");
	for (const device of ["desktop", "mobile"]) {
		assert.ok(independent.deviceConfig[device].hideSelectors.includes(".tp-modal"));
		assert.ok(independent.deviceConfig[device].hideSelectors.includes(".tp-backdrop"));
	}
	for (const device of ["desktop", "mobile"]) {
		assert.ok(
			guardian.deviceConfig[device].clickActions.some((action) => {
				return (
					action.frameUrlIncludes?.includes("sourcepoint.theguardian.com") &&
					action.selector.includes('button[title="Accept all"]')
				);
			}),
		);
	}
	assert.ok(
		newsquest.deviceConfig.desktop.clickActions.some((action) => {
			return action.frameUrlIncludes?.includes("privacy-mgmt.com");
		}),
	);
	assert.ok(
		newsquest.deviceConfig.mobile.styles.some((style) => {
			return style.includes("overflow-y: auto !important");
		}),
	);

	assert.ok(reach.deviceConfig.desktop.hideSelectors.includes("#qc-cmp2-container"));
	assert.ok(reach.deviceConfig.mobile.hideSelectors.includes("#div-gpt-ad-top-slot"));
	assert.ok(sky.deviceConfig.mobile.hideSelectors.includes(".ui-news-header-nav"));
	assert.ok(
		sky.deviceConfig.mobile.clickActions.some(({ frameUrlIncludes }) =>
			frameUrlIncludes?.includes("consent"),
		),
	);
	assert.ok(
		sky.deviceConfig.mobile.styles.includes(".ui-news-header-body { height: 50px !important; }"),
	);
	assert.ok(times.deviceConfig.desktop.hideSelectors.includes('iframe[id^="sp_message_iframe_"]'));
	assert.match(telegraph.deviceConfig.desktop.userAgent, /Android/);
	assert.equal(telegraph.deviceConfig.desktop.userAgentMetadata.mobile, true);
	assert.equal(telegraph.deviceConfig.desktop.userAgentMetadata.model, "Pixel 9 Pro");
	assert.ok(
		nytimes.deviceConfig.desktop.clickActions.some(({ selector }) =>
			selector.includes("#fides-reject-all-button"),
		),
	);
	assert.equal(nytimes.deviceConfig.desktop.scroll.behavior, "auto");
	assert.equal(nytimes.deviceConfig.desktop.scroll.minDelayMs, 350);
	assert.ok(nytimes.deviceConfig.mobile.hideSelectors.includes("#fides-overlay"));
	assert.ok(
		metro.deviceConfig.desktop.clickActions.some((action) => {
			return (
				action.frameUrlIncludes?.includes("cmp.dmgmediaprivacy.co.uk") &&
				action.selector.includes('button[aria-label="Accept all"]')
			);
		}),
	);
	assert.ok(
		metro.deviceConfig.mobile.hideSelectors.includes(
			'iframe[src^="https://cmp.dmgmediaprivacy.co.uk/"]',
		),
	);
});

test("falls back to defaults for an unknown profile", () => {
	const profile = resolveCaptureProfile(site({ profile: "missing" }));

	assert.deepEqual(profile.deviceConfig.desktop.viewport, { height: 1008, width: 1740 });
	assert.deepEqual(profile.deviceConfig.desktop.cookies, []);
});

test("returns fresh arrays so one resolution cannot contaminate another", () => {
	const first = resolveCaptureProfile(site({ brand: "bbc" }));
	first.deviceConfig.desktop.hideSelectors.push(".mutation");
	first.deviceConfig.desktop.styles.push(".mutation {}");
	first.failureIndicators.push({ reason: "mutation", text: "mutation" });

	const second = resolveCaptureProfile(site({ brand: "bbc" }));
	assert.equal(second.deviceConfig.desktop.hideSelectors.includes(".mutation"), false);
	assert.equal(second.deviceConfig.desktop.styles.includes(".mutation {}"), false);
	assert.equal(
		second.failureIndicators.some(({ reason }) => reason === "mutation"),
		false,
	);
});
