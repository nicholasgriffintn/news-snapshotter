import type { Device, SiteDefinition } from '../types';

export function safeSegment(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

export function screenshotKey(
	site: SiteDefinition,
	capturedAt: string,
	device: Device,
	extension: 'jpeg' | 'png' | 'webp',
): string {
	const date = capturedAt.slice(0, 10);
	const timestamp = capturedAt.replace(/[:.]/g, '-');

	return [
		`brand=${safeSegment(site.brand)}`,
		`category=${site.category}`,
		`date=${date}`,
		`${safeSegment(site.name)}-${device}-${timestamp}.${extension}`,
	].join('/');
}

export function thumbnailKey(fullScreenshotKey: string): string {
	return fullScreenshotKey.replace(/\.(?:jpe?g|png|webp)$/, '-thumbnail.jpg');
}
