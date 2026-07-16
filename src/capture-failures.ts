import type { Env } from './env';
import { errorMessage } from './lib/errors';
import { safeSegment } from './lib/storage-key';
import type { Device, SiteDefinition } from './types';

const FAILURE_RETENTION_SECONDS = 90 * 24 * 60 * 60;

export type CaptureFailure = {
	capturedAt: string;
	device: Device;
	message: string;
	reason: string;
	site: SiteDefinition;
};

export async function storeCaptureFailure(
	env: Pick<Env, 'CAPTURE_FAILURES'>,
	failure: CaptureFailure,
): Promise<string | undefined> {
	const timestamp = failure.capturedAt.replace(/[:.]/g, '-');
	const key = [
		'failures',
		`date=${failure.capturedAt.slice(0, 10)}`,
		`${timestamp}-${safeSegment(failure.site.name)}-${failure.device}.json`,
	].join('/');
	const record = {
		brand: failure.site.brand,
		capturedAt: failure.capturedAt,
		category: failure.site.category,
		device: failure.device,
		message: failure.message.slice(0, 500),
		name: failure.site.name,
		reason: failure.reason,
		storedAt: new Date().toISOString(),
		url: failure.site.url,
	};

	try {
		await env.CAPTURE_FAILURES.put(key, JSON.stringify(record), {
			expirationTtl: FAILURE_RETENTION_SECONDS,
			metadata: {
				brand: failure.site.brand,
				device: failure.device,
				reason: failure.reason,
			},
		});
		return key;
	} catch (error) {
		console.error('Could not store capture failure', {
			device: failure.device,
			error: errorMessage(error),
			name: failure.site.name,
		});
		return undefined;
	}
}
