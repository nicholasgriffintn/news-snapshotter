import type { Page } from "@cloudflare/puppeteer";

import { collectAndStoreAnalysis } from "./capture-analysis.ts";
import type { DeviceCaptureConfig } from "../domain/profiles.ts";
import type { Env } from "../../../platform/cloudflare/env.ts";
import { screenshotKey, thumbnailKey } from "../../../core/storage-key.ts";
import { takeFullScreenshot } from "./full-page-screenshot.ts";
import type { Device, ScreenshotResult, SiteDefinition } from "../../../core/domain.ts";

export async function storeCaptureArtefacts(input: {
	config: DeviceCaptureConfig;
	device: Device;
	env: Pick<Env, "ARCHIVE_DATA" | "SCREENSHOTS">;
	page: Page;
	profileName: string;
	site: SiteDefinition;
	triggeredAt: string;
}): Promise<ScreenshotResult> {
	const { config, device, env, page, profileName, site, triggeredAt } = input;
	const capturedAt = new Date().toISOString();
	const extension = config.screenshot?.type ?? "png";
	const key = screenshotKey(site, triggeredAt, device, extension);
	const analysis =
		site.analysis && site.analysis.device === device
			? await collectAndStoreAnalysis({
					bucket: env.ARCHIVE_DATA,
					capturedAt,
					device,
					page,
					profile: profileName,
					screenshotKey: key,
					site,
					triggeredAt,
				})
			: undefined;
	const screenshot = await takeFullScreenshot(page, config);
	const thumbnailConfig = config.thumbnail ?? { type: "jpeg" as const, quality: 72 };
	const thumbnail = await page.screenshot({
		quality: thumbnailConfig.quality,
		type: thumbnailConfig.type,
	});

	const customMetadata = {
		brand: site.brand,
		capturedAt,
		category: site.category,
		device,
		name: site.name,
		triggeredAt,
		url: site.url,
		visibility: site.visibility ?? "public",
	};

	await env.SCREENSHOTS.put(thumbnailKey(key), thumbnail, {
		httpMetadata: { contentType: `image/${thumbnailConfig.type}` },
		customMetadata,
	});
	await env.SCREENSHOTS.put(key, screenshot, {
		httpMetadata: { contentType: `image/${extension}` },
		customMetadata,
	});

	return { analysis, capturedAt, device, key, name: site.name, status: "success", triggeredAt };
}
