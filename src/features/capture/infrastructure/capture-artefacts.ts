import type { Page } from "@cloudflare/puppeteer";

import { collectAndStoreAnalysis } from "./capture-analysis.ts";
import type { DeviceCaptureConfig } from "../domain/profiles.ts";
import type { Env } from "../../../platform/cloudflare/env.ts";
import { screenshotKey, thumbnailKey } from "../../../core/storage-key.ts";
import { takeFullScreenshot } from "./full-page-screenshot.ts";
import type { Device, ScreenshotResult, SiteDefinition } from "../../../core/domain.ts";
import { errorMessage } from "../../../core/errors.ts";

export async function storeCaptureArtefacts(input: {
	config: DeviceCaptureConfig;
	device: Device;
	env: Pick<Env, "ARCHIVE_DATA" | "HISTORY_INDEX_QUEUE" | "SCREENSHOTS">;
	page: Page;
	profileName: string;
	site: SiteDefinition;
	triggeredAt: string;
}): Promise<ScreenshotResult> {
	const { config, device, env, page, profileName, site, triggeredAt } = input;
	const capturedAt = new Date().toISOString();
	const extension = config.screenshot?.type ?? "png";
	const key = screenshotKey(site, triggeredAt, device, extension);
	let analysis =
		site.analysis && site.analysis.device === device
			? await collectAndStoreAnalysis({
					bucket: env.ARCHIVE_DATA,
					capturedAt,
					device,
					page,
					profile: profileName,
					screenshotBucket: env.SCREENSHOTS,
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

	const indexMessage =
		analysis?.status === "stored" && analysis.extractionKey
			? {
					captureId: `${site.name}:${device}:${triggeredAt}`,
					extractionKey: analysis.extractionKey,
					kind: "extraction" as const,
					site: site.name,
				}
			: analysis?.status === "failed" && analysis.failureKey
				? {
						failureKey: analysis.failureKey,
						kind: "failure" as const,
					}
				: undefined;

	if (analysis && indexMessage) {
		let indexingStatus: NonNullable<ScreenshotResult["analysis"]>["indexingStatus"] = "not-queued";
		try {
			await env.HISTORY_INDEX_QUEUE.send(indexMessage);
			indexingStatus = "pending";
		} catch (error) {
			console.error("Could not queue capture history indexing", {
				captureId: `${site.name}:${device}:${triggeredAt}`,
				error: errorMessage(error),
			});
		}
		analysis = { ...analysis, indexingStatus };
	}

	return { analysis, capturedAt, device, key, name: site.name, status: "success", triggeredAt };
}
