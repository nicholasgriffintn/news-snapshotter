import type { Env } from "../../../platform/cloudflare/env.ts";
import { thumbnailKey } from "../../../core/storage-key.ts";
import type { Device, ScreenshotSummary, SiteCategory } from "../../../core/domain.ts";

const PREFIX_LIST_CONCURRENCY = 16;
const SCREENSHOT_KEY =
	/^brand=[a-z0-9-]+\/category=(news|sport)\/date=\d{4}-\d{2}-\d{2}\/[a-z0-9-]+-(?:(?:desktop|mobile)-)?\d{4}-\d{2}-\d{2}T[\d-]+Z(?:-thumbnail\.jpg|\.(?:jpe?g|png|webp))$/;
const SCREENSHOT_CROP_KEY =
	/^brand=[a-z0-9-]+\/category=(news|sport)\/date=\d{4}-\d{2}-\d{2}\/site=[a-z0-9-]+\/device=(desktop|mobile)\/\d{4}-\d{2}-\d{2}T[\d-]+Z\.image-\d{2}\.jpeg$/;

export function screenshotImageUrl(key: string): string {
	return `/api/screenshots/image?key=${encodeURIComponent(key)}`;
}

export async function listScreenshots(
	bucket: R2Bucket,
	prefixes: readonly string[],
	displayNames: ReadonlyMap<string, string> = new Map(),
): Promise<{
	screenshots: ScreenshotSummary[];
	truncated: boolean;
}> {
	const objects: R2Object[] = [];
	for (let index = 0; index < prefixes.length; index += PREFIX_LIST_CONCURRENCY) {
		const batch = prefixes.slice(index, index + PREFIX_LIST_CONCURRENCY);
		const pages = await Promise.all(
			batch.map(async (prefix) => {
				const prefixObjects: R2Object[] = [];
				let cursor: string | undefined;
				do {
					const page = await bucket.list({
						cursor,
						include: ["customMetadata"],
						limit: 1_000,
						prefix,
					});
					prefixObjects.push(
						...page.objects.filter((object) => {
							return (
								!object.key.includes("-thumbnail.") && /\.(?:jpe?g|png|webp)$/.test(object.key)
							);
						}),
					);
					cursor = page.truncated ? page.cursor : undefined;
				} while (cursor);
				return prefixObjects;
			}),
		);
		objects.push(...pages.flat());
	}

	const screenshots = objects.flatMap((object): ScreenshotSummary[] => {
		const metadata = object.customMetadata;

		if (
			metadata?.visibility === "admin" ||
			!metadata?.brand ||
			!metadata.capturedAt ||
			!metadata.category ||
			!metadata.name ||
			!metadata.triggeredAt ||
			!metadata.url ||
			!["news", "sport"].includes(metadata.category)
		) {
			return [];
		}

		return [
			{
				brand: metadata.brand,
				capturedAt: metadata.capturedAt,
				category: metadata.category as SiteCategory,
				device: (metadata.device as Device | undefined) ?? "desktop",
				displayName: metadata.displayName ?? displayNames.get(metadata.name),
				fullImageUrl: screenshotImageUrl(object.key),
				key: object.key,
				name: metadata.name,
				thumbnailUrl: screenshotImageUrl(thumbnailKey(object.key)),
				triggeredAt: metadata.triggeredAt,
				url: metadata.url,
			},
		];
	});

	screenshots.sort((left, right) => right.capturedAt.localeCompare(left.capturedAt));

	return { screenshots, truncated: false };
}

export async function serveScreenshot(
	request: Request,
	env: Pick<Env, "SCREENSHOTS">,
): Promise<Response> {
	const key = new URL(request.url).searchParams.get("key");
	if (!key || (!SCREENSHOT_KEY.test(key) && !SCREENSHOT_CROP_KEY.test(key))) {
		return Response.json({ message: "Invalid screenshot key" }, { status: 400 });
	}

	const object = await env.SCREENSHOTS.get(key, { onlyIf: request.headers });
	if (!object) {
		return Response.json({ message: "Screenshot not found" }, { status: 404 });
	}
	if (object.customMetadata?.visibility === "admin") {
		return Response.json({ message: "Screenshot not found" }, { status: 404 });
	}

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("cache-control", "public, max-age=31536000, immutable");
	headers.set("etag", object.httpEtag);

	if (!("body" in object)) {
		return new Response(null, { headers, status: 304 });
	}

	return new Response(object.body, { headers });
}
