import puppeteer from '@cloudflare/puppeteer';

import type { Env } from './env';
import { screenshotKey } from './lib/storage-key';
import type { ScreenshotResult, SiteDefinition } from './types';

export async function captureSite(
	env: Pick<Env, 'BROWSER' | 'SCREENSHOTS'>,
	site: SiteDefinition,
	capturedAt: string,
): Promise<ScreenshotResult> {
	const browser = await puppeteer.launch(env.BROWSER);

	try {
		const page = await browser.newPage();
		await page.setViewport({ width: 1740, height: 1008 });
		await page.goto(site.url, { waitUntil: 'networkidle0', timeout: 60_000 });

		if (site.requestBody?.addStyleTag) {
			await page.addStyleTag({ content: site.requestBody.addStyleTag });
		}

		const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
		const key = screenshotKey(site, capturedAt);

		await env.SCREENSHOTS.put(key, screenshot, {
			httpMetadata: { contentType: 'image/png' },
			customMetadata: {
				brand: site.brand,
				category: site.category,
				capturedAt,
				name: site.name,
				url: site.url,
			},
		});

		return { name: site.name, status: 'success', key };
	} finally {
		await browser.close();
	}
}
