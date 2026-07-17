import { captureDevice } from './browser-rendering.ts';
import { resolveCaptureProfile } from './capture-profiles.ts';
import type { Env } from './env';
import { safeSegment } from './lib/storage-key.ts';
import type { Device, ScreenshotResult, SiteDefinition } from './types';

const AM_I_A_BOT_URL = 'https://amiabot.app/';

type CaptureDevice = (
	env: Pick<Env, 'ARCHIVE_DATA' | 'BROWSER' | 'CAPTURE_FAILURES' | 'SCREENSHOTS'>,
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
		brand: 'amiabot',
		category: 'news',
		completion: {
			selector: '#status',
			textStartsWith: 'Classification:',
			timeoutMs: 30_000,
		},
		name: `amiabot-${safeSegment(profile)}`,
		profile,
		runtimeQuietMs: 12_000,
		url: AM_I_A_BOT_URL,
		visibility: 'admin',
	};
	const { devices } = resolveCaptureProfile(site);
	const results: ScreenshotResult[] = [];

	for (const device of devices) {
		results.push(await capture(env, site, device, triggeredAt));
	}

	return { profile, results, triggeredAt, url: AM_I_A_BOT_URL };
}
