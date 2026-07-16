import type { SiteDefinition } from '../types';

function safeSegment(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

export function screenshotKey(site: SiteDefinition, capturedAt: string): string {
	const date = capturedAt.slice(0, 10);
	const timestamp = capturedAt.replace(/[:.]/g, '-');

	return [
		`brand=${safeSegment(site.brand)}`,
		`category=${site.category}`,
		`date=${date}`,
		`${safeSegment(site.name)}-${timestamp}.png`,
	].join('/');
}
