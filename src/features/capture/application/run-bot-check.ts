import { captureDevice } from "./capture-device.ts";
import { resolveCaptureProfile } from "../domain/profiles.ts";
import type { Env } from "../../../platform/cloudflare/env.ts";
import { safeSegment } from "../../../core/storage-key.ts";
import type { Device, ScreenshotResult, SiteDefinition } from "../../../core/domain.ts";

const AM_I_A_BOT_URL = "https://amiabot.app/";

type CaptureDevice = (
	env: Pick<
		Env,
		| "ARCHIVE_DATA"
		| "BROWSER"
		| "CAPTURE_FAILURES"
		| "HYPERBROWSER_API_KEY"
		| "SCREENSHOTS"
	>,
	site: SiteDefinition,
	device: Device,
	triggeredAt: string,
) => Promise<ScreenshotResult>;

export async function runBotCheck(
	env: Env,
	profile: string,
	capture: CaptureDevice = captureDevice,
) {
	const triggeredAt = new Date().toISOString();
	const site: SiteDefinition = {
		brand: "amiabot",
		captureRegion: "international",
		category: "news",
		completion: {
			selector: "#status",
			textStartsWith: "Classification:",
			timeoutMs: 30_000,
		},
		name: `amiabot-${safeSegment(profile)}`,
		priority: 3,
		profile,
		runtimeQuietMs: 12_000,
		url: AM_I_A_BOT_URL,
		visibility: "admin",
	};
	const { devices } = resolveCaptureProfile(site);
	const results: ScreenshotResult[] = [];

	for (const device of devices) {
		results.push(await capture(env, site, device, triggeredAt));
	}

	return { profile, results, triggeredAt, url: AM_I_A_BOT_URL };
}
