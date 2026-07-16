import type { Env } from './env';
import { errorMessage } from './lib/errors.ts';
import { safeSegment } from './lib/storage-key.ts';
import type { Device, SiteDefinition } from './types';

const FAILURE_RETENTION_SECONDS = 90 * 24 * 60 * 60;

export type CaptureFailure = {
	capturedAt: string;
	device: Device;
	message: string;
	reason: string;
	site: SiteDefinition;
	triggeredAt: string;
};

export type StoredCaptureFailure = {
	brand: string;
	capturedAt: string;
	category: SiteDefinition['category'];
	device: Device;
	message: string;
	name: string;
	reason: string;
	storedAt: string;
	url: string;
	triggeredAt: string;
};

export type CaptureFailurePage = {
	cursor?: string;
	failures: StoredCaptureFailure[];
	hasMore: boolean;
};

function parseStoredFailure(value: string | null): StoredCaptureFailure | undefined {
	if (!value) return undefined;

	try {
		const record: unknown = JSON.parse(value);
		if (!record || typeof record !== 'object' || Array.isArray(record)) return undefined;
		const failure = record as Record<string, unknown>;
		const requiredStrings = [
			'brand',
			'capturedAt',
			'category',
			'device',
			'message',
			'name',
			'reason',
			'storedAt',
			'triggeredAt',
			'url',
		];
		if (!requiredStrings.every((field) => typeof failure[field] === 'string')) return undefined;
		if (failure.category !== 'news' && failure.category !== 'sport') return undefined;
		if (failure.device !== 'desktop' && failure.device !== 'mobile') return undefined;
		return failure as StoredCaptureFailure;
	} catch {
		return undefined;
	}
}

export async function listCaptureFailures(
	env: Pick<Env, 'CAPTURE_FAILURES'>,
	options: { cursor?: string; limit: number },
): Promise<CaptureFailurePage> {
	const page = await env.CAPTURE_FAILURES.list({
		cursor: options.cursor,
		limit: options.limit,
		prefix: 'failures/',
	});
	const values = await Promise.all(page.keys.map(({ name }) => env.CAPTURE_FAILURES.get(name)));
	const failures = values.flatMap((value) => {
		const failure = parseStoredFailure(value);
		return failure ? [failure] : [];
	});
	failures.sort((left, right) => right.capturedAt.localeCompare(left.capturedAt));

	return {
		cursor: page.list_complete ? undefined : page.cursor,
		failures,
		hasMore: !page.list_complete,
	};
}

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
		triggeredAt: failure.triggeredAt,
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
