import type { Device, SiteDefinition } from './types';

export type FailureIndicator = {
	reason: string;
	text: string;
};

export type BlockSelector = {
	reason: string;
	selector: string;
};

export type DeviceCaptureConfig = {
	blockSelectors?: BlockSelector[];
	cookies?: Array<{ name: string; url: string; value: string }>;
	deviceScaleFactor?: number;
	hasTouch?: boolean;
	hideSelectors?: string[];
	isMobile?: boolean;
	javaScriptEnabled?: boolean;
	navigationTimeoutMs?: number;
	scroll?: { distance: number; waitMs: number };
	screenshot?: { fullPage: boolean; type: 'jpeg' | 'png' | 'webp'; quality?: number };
	thumbnail?: { quality: number; type: 'jpeg' | 'webp' };
	userAgent?: string;
	viewport: { height: number; width: number };
	waitAfterLoadMs?: number;
	waitForImagesMs?: number;
	waitForSelector?: { selector: string; timeoutMs: number };
};

type CaptureProfile = {
	devices?: Device[];
	deviceConfig?: Partial<Record<Device, Partial<DeviceCaptureConfig>>>;
	failureIndicators?: FailureIndicator[];
};

export type ResolvedCaptureProfile = {
	devices: Device[];
	deviceConfig: Record<Device, DeviceCaptureConfig>;
	failureIndicators: FailureIndicator[];
};

const DESKTOP_USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36';
const MOBILE_USER_AGENT =
	'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36';

const FAILURE_INDICATORS: FailureIndicator[] = [
	{ reason: 'access-denied', text: 'access denied' },
	{ reason: 'akamai-access-denied', text: 'errors.edgesuite.net' },
	{ reason: 'captcha', text: 'complete the captcha' },
	{ reason: 'captcha', text: 'captcha verification' },
	{ reason: 'not-a-robot', text: 'not a robot' },
	{ reason: 'please-verify', text: 'please verify you are a human' },
	{ reason: 'please-verify', text: 'please verify that you are human' },
	{ reason: 'unusual-activity', text: 'unusual activity' },
];

const GENERIC_CONSENT_SELECTORS = [
	'#onetrust-banner-sdk',
	'#onetrust-consent-sdk',
	'.fc-consent-root',
	'[aria-label="Cookie banner"]',
	'[data-testid="cookie-banner"]',
	'[id*="sp_message_container"]',
];

const DEFAULT_DEVICE_CONFIG: Record<Device, DeviceCaptureConfig> = {
	desktop: {
		viewport: { width: 1740, height: 1008 },
		javaScriptEnabled: true,
		navigationTimeoutMs: 60_000,
		screenshot: { type: 'png', fullPage: true },
		thumbnail: { type: 'jpeg', quality: 72 },
		userAgent: DESKTOP_USER_AGENT,
		waitForImagesMs: 5_000,
		hideSelectors: GENERIC_CONSENT_SELECTORS,
	},
	mobile: {
		viewport: { width: 412, height: 915 },
		deviceScaleFactor: 2.625,
		hasTouch: true,
		isMobile: true,
		javaScriptEnabled: true,
		navigationTimeoutMs: 60_000,
		screenshot: { type: 'png', fullPage: true },
		thumbnail: { type: 'jpeg', quality: 72 },
		userAgent: MOBILE_USER_AGENT,
		waitForImagesMs: 5_000,
		hideSelectors: GENERIC_CONSENT_SELECTORS,
	},
};

const CHALLENGE_SELECTORS: BlockSelector[] = [
	{ selector: '#challenge-running', reason: 'cloudflare-challenge' },
	{ selector: '[data-testid="captcha"]', reason: 'captcha' },
];

const PROFILES: Record<string, CaptureProfile> = {
	default: {},
	bbc: {
		deviceConfig: {
			desktop: {
				cookies: [
					{ name: 'ckns_policy', value: '111', url: 'https://www.bbc.co.uk' },
					{ name: 'ckns_explicit', value: '1', url: 'https://www.bbc.co.uk' },
				],
			},
			mobile: {
				cookies: [
					{ name: 'ckns_policy', value: '111', url: 'https://www.bbc.co.uk' },
					{ name: 'ckns_explicit', value: '1', url: 'https://www.bbc.co.uk' },
				],
			},
		},
	},
	sky: {
		deviceConfig: {
			desktop: {
				blockSelectors: CHALLENGE_SELECTORS,
				scroll: { distance: 900, waitMs: 100 },
				waitAfterLoadMs: 5_000,
			},
			mobile: {
				blockSelectors: CHALLENGE_SELECTORS,
				scroll: { distance: 700, waitMs: 100 },
				waitAfterLoadMs: 5_000,
			},
		},
	},
	skysports: {
		deviceConfig: {
			desktop: { blockSelectors: CHALLENGE_SELECTORS, waitAfterLoadMs: 5_000 },
			mobile: { blockSelectors: CHALLENGE_SELECTORS, waitAfterLoadMs: 5_000 },
		},
	},
	times: {
		failureIndicators: [
			{ reason: 'device-verification', text: 'verifying your device' },
			{ reason: 'device-verification', text: 'verification failed. please try again' },
		],
	},
	telegraph: {
		deviceConfig: {
			desktop: {
				blockSelectors: [{ selector: '#sec-if-cpt-container', reason: 'akamai-challenge' }],
			},
			mobile: {
				blockSelectors: [{ selector: '#sec-if-cpt-container', reason: 'akamai-challenge' }],
			},
		},
	},
	bloomberg: {
		deviceConfig: {
			desktop: {
				blockSelectors: [
					{ selector: '#px-captcha', reason: 'captcha' },
					{ selector: '.challenge-form', reason: 'challenge' },
				],
				scroll: { distance: 1_000, waitMs: 150 },
				viewport: { width: 1920, height: 1080 },
				waitAfterLoadMs: 3_000,
			},
			mobile: {
				blockSelectors: [{ selector: '#px-captcha', reason: 'captcha' }],
				scroll: { distance: 700, waitMs: 150 },
				waitAfterLoadMs: 3_000,
			},
		},
		failureIndicators: [
			{ reason: 'security-systems', text: 'security systems have detected' },
			{ reason: 'tollbit-token', text: 'valid tollbit token' },
		],
	},
};

export const CAPTURE_PROFILE_NAMES = Object.keys(PROFILES).sort();

export function hasCaptureProfile(name: string): boolean {
	return Object.hasOwn(PROFILES, name);
}

function mergeDeviceConfig(
	base: DeviceCaptureConfig,
	overrides?: Partial<DeviceCaptureConfig>,
): DeviceCaptureConfig {
	return {
		...base,
		...overrides,
		blockSelectors: [...(base.blockSelectors ?? []), ...(overrides?.blockSelectors ?? [])],
		cookies: [...(base.cookies ?? []), ...(overrides?.cookies ?? [])],
		hideSelectors: [...(base.hideSelectors ?? []), ...(overrides?.hideSelectors ?? [])],
		viewport: overrides?.viewport ?? base.viewport,
	};
}

export function resolveCaptureProfile(site: SiteDefinition): ResolvedCaptureProfile {
	const profile = PROFILES[site.profile ?? site.brand] ?? PROFILES.default;
	return {
		devices: profile.devices ?? ['desktop', 'mobile'],
		deviceConfig: {
			desktop: mergeDeviceConfig(DEFAULT_DEVICE_CONFIG.desktop, profile.deviceConfig?.desktop),
			mobile: mergeDeviceConfig(DEFAULT_DEVICE_CONFIG.mobile, profile.deviceConfig?.mobile),
		},
		failureIndicators: [...FAILURE_INDICATORS, ...(profile.failureIndicators ?? [])],
	};
}
