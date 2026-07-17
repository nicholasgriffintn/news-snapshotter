import { storeCaptureArtefacts } from "../infrastructure/capture-artefacts.ts";
import { DetectedCaptureError, preparePageForCapture } from "./prepare-page.ts";
import {
	captureProviderManagesFingerprint,
	openCaptureBrowser,
} from "../adapters/provider-registry.ts";
import { resolveCaptureProfile } from "../domain/profiles.ts";
import { storeCaptureFailure } from "../infrastructure/capture-failures.ts";
import type { Env } from "../../../platform/cloudflare/env.ts";
import { errorMessage } from "../../../core/errors.ts";
import type { Device, ScreenshotResult, SiteDefinition } from "../../../core/domain.ts";

type CaptureEnv = Pick<
	Env,
	"ARCHIVE_DATA" | "BROWSER" | "HYPERBROWSER_API_KEY" | "SCREENSHOTS"
>;

async function capture(
	env: CaptureEnv,
	site: SiteDefinition,
	device: Device,
	triggeredAt: string,
): Promise<ScreenshotResult> {
	const profile = resolveCaptureProfile(site);
	const config = profile.deviceConfig[device];
	const browserSession = await openCaptureBrowser(profile.provider, {
		config,
		device,
		env,
		site,
	});

	try {
		await preparePageForCapture({
			config,
			failureIndicators: profile.failureIndicators,
			page: browserSession.page,
			providerManagesFingerprint: captureProviderManagesFingerprint(profile.provider),
			site,
		});

		return await storeCaptureArtefacts({
			config,
			device,
			env,
			page: browserSession.page,
			profileName: site.profile ?? site.brand,
			site,
			triggeredAt,
		});
	} finally {
		try {
			await browserSession.close();
		} catch (error) {
			console.error("Could not close browser session", {
				device,
				error: errorMessage(error),
				name: site.name,
			});
		}
	}
}

export async function captureDevice(
	env: CaptureEnv & Pick<Env, "CAPTURE_FAILURES">,
	site: SiteDefinition,
	device: Device,
	triggeredAt: string,
): Promise<ScreenshotResult> {
	try {
		return await capture(env, site, device, triggeredAt);
	} catch (error) {
		const reason = error instanceof DetectedCaptureError ? error.reason : "capture-error";
		const message = errorMessage(error);
		const capturedAt = new Date().toISOString();
		const failureKey = await storeCaptureFailure(env, {
			capturedAt,
			device,
			message,
			reason,
			site,
			triggeredAt,
		});
		return {
			capturedAt,
			device,
			error: message,
			failureKey,
			name: site.name,
			status: "error",
			triggeredAt,
		};
	}
}
