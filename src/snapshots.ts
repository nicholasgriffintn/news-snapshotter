import type { Env } from './env';
import { thumbnailKey } from './lib/storage-key';
import type { Device, ScreenshotSummary, SiteCategory } from './types';

const MAX_SCREENSHOTS = 2_000;
const SCREENSHOT_KEY = /^brand=[a-z0-9-]+\/category=(news|sport)\/date=\d{4}-\d{2}-\d{2}\/[a-z0-9-]+-(?:(?:desktop|mobile)-)?\d{4}-\d{2}-\d{2}T[\d-]+Z(?:-thumbnail\.jpg|\.(?:jpe?g|png|webp))$/;

function imageUrl(key: string): string {
	return `/api/screenshots/image?key=${encodeURIComponent(key)}`;
}

export async function listScreenshots(bucket: R2Bucket): Promise<{
	screenshots: ScreenshotSummary[];
	truncated: boolean;
}> {
	const objects: R2Object[] = [];
	let cursor: string | undefined;
	let truncated = false;

	do {
		const page = await bucket.list({ cursor, include: ['customMetadata'], limit: 1_000 });
		objects.push(
			...page.objects.filter((object) => {
				return !object.key.includes('-thumbnail.') && /\.(?:jpe?g|png|webp)$/.test(object.key);
			}),
		);
		cursor = page.truncated ? page.cursor : undefined;
		truncated = objects.length >= MAX_SCREENSHOTS && Boolean(cursor);
	} while (cursor && objects.length < MAX_SCREENSHOTS);

	const screenshots = objects.flatMap((object): ScreenshotSummary[] => {
		const metadata = object.customMetadata;
		if (
			!metadata?.brand ||
			!metadata.capturedAt ||
			!metadata.category ||
			!metadata.name ||
			!metadata.url ||
			!['news', 'sport'].includes(metadata.category)
		) {
			return [];
		}

		return [
			{
				brand: metadata.brand,
				capturedAt: metadata.capturedAt,
				category: metadata.category as SiteCategory,
				device: (metadata.device as Device | undefined) ?? 'desktop',
				fullImageUrl: imageUrl(object.key),
				key: object.key,
				name: metadata.name,
				thumbnailUrl: imageUrl(thumbnailKey(object.key)),
				url: metadata.url,
			},
		];
	});

	screenshots.sort((left, right) => right.capturedAt.localeCompare(left.capturedAt));

	return { screenshots, truncated };
}

export async function serveScreenshot(request: Request, env: Pick<Env, 'SCREENSHOTS'>): Promise<Response> {
	const key = new URL(request.url).searchParams.get('key');
	if (!key || !SCREENSHOT_KEY.test(key)) {
		return Response.json({ message: 'Invalid screenshot key' }, { status: 400 });
	}

	const object = await env.SCREENSHOTS.get(key);
	if (!object) {
		return Response.json({ message: 'Screenshot not found' }, { status: 404 });
	}

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set('cache-control', 'public, max-age=3600');
	headers.set('etag', object.httpEtag);

	return new Response(object.body, { headers });
}
