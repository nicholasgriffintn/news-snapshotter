import type { CaptureProviderName, Device, SiteDefinition } from "../../../core/domain.ts";
import { DEFAULT_PROGRESSIVE_SCROLL, type ProgressiveScrollConfig } from "./scroll-policy.ts";

export type FailureIndicator = {
	reason: string;
	text: string;
};

export type BlockSelector = {
	reason: string;
	selector: string;
};

export type ClickAction = {
	frameUrlIncludes?: string[];
	selector: string;
	timeoutMs?: number;
	waitAfterMs?: number;
};

export type DeviceCaptureConfig = {
	blockSelectors?: BlockSelector[];
	clickActions?: ClickAction[];
	cookies?: Array<{ name: string; url: string; value: string }>;
	deviceScaleFactor?: number;
	extraHTTPHeaders?: Record<string, string>;
	hasTouch?: boolean;
	hideSelectors?: string[];
	hideWebdriver?: boolean;
	isMobile?: boolean;
	javaScriptEnabled?: boolean;
	navigationTimeoutMs?: number;
	responseOverrides?: Array<{
		body: Record<string, string>;
		url: string;
	}>;
	runtimeQuietMs?: number;
	scroll?: ProgressiveScrollConfig;
	screenshot?: { fullPage: boolean; type: "jpeg" | "png" | "webp"; quality?: number };
	styles?: string[];
	thumbnail?: { quality: number; type: "jpeg" | "webp" };
	userAgent?: string;
	userAgentMetadata?: {
		architecture: string;
		brands: Array<{ brand: string; version: string }>;
		fullVersionList: Array<{ brand: string; version: string }>;
		mobile: boolean;
		model: string;
		platform: string;
		platformVersion: string;
	};
	viewport: { height: number; width: number };
	waitAfterLoadMs?: number;
	waitForImagesMs?: number;
	waitForSelector?: { selector: string; timeoutMs: number };
};

type CaptureProfile = {
	devices?: Device[];
	deviceConfig?: Partial<Record<Device, Partial<DeviceCaptureConfig>>>;
	failureIndicators?: FailureIndicator[];
	provider?: CaptureProviderName;
};

function forBothDevices(config: Partial<DeviceCaptureConfig>): CaptureProfile["deviceConfig"] {
	return { desktop: config, mobile: config };
}

export type ResolvedCaptureProfile = {
	devices: Device[];
	deviceConfig: Record<Device, DeviceCaptureConfig>;
	failureIndicators: FailureIndicator[];
	provider: CaptureProviderName;
};

const DESKTOP_USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36";
const MOBILE_USER_AGENT =
	"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36";

const CHROME_BRANDS = [
	{ brand: "Google Chrome", version: "131" },
	{ brand: "Chromium", version: "131" },
	{ brand: "Not_A Brand", version: "24" },
];

const CHROME_FULL_VERSIONS = CHROME_BRANDS.map(({ brand, version }) => ({
	brand,
	version: version === "24" ? version : `${version}.0.0.0`,
}));

const FAILURE_INDICATORS: FailureIndicator[] = [
	{ reason: "access-denied", text: "access denied" },
	{ reason: "akamai-access-denied", text: "errors.edgesuite.net" },
	{ reason: "captcha", text: "complete the captcha" },
	{ reason: "captcha", text: "captcha verification" },
	{ reason: "not-a-robot", text: "not a robot" },
	{ reason: "please-verify", text: "please verify you are a human" },
	{ reason: "please-verify", text: "please verify that you are human" },
	{ reason: "unusual-activity", text: "unusual activity" },
];

const GENERIC_CONSENT_SELECTORS = [
	"#onetrust-banner-sdk",
	"#onetrust-consent-sdk",
	".fc-consent-root",
	".smartbanner",
	'[aria-label="Cookie banner"]',
	'[class*="app-banner"]',
	'[class*="appBanner"]',
	'[class*="smart-banner"]',
	'[class*="smartbanner"]',
	'[data-testid="cookie-banner"]',
	'[data-testid*="app-banner"]',
	'[id*="sp_message_container"]',
	'[id*="smartbanner"]',
];

const METRO_CONSENT_SELECTOR = [
	'#qc-cmp2-ui button[mode="primary"]',
	".fc-consent-root .fc-cta-consent",
	"#didomi-notice-agree-button",
].join(", ");

const METRO_CONSENT_HIDE_SELECTORS = ["#didomi-popup", "#qc-cmp2-container", ".qc-cmp-cleanslate"];

const BBC_USERINFO_OVERRIDE = {
	body: {
		"X-Country": "gb",
		"X-Ip_is_uk_combined": "yes",
		"X-Ip_is_advertise_combined": "no",
	},
	url: "https://www.bbc.co.uk/userinfo",
};

const DEFAULT_DEVICE_CONFIG: Record<Device, DeviceCaptureConfig> = {
	desktop: {
		clickActions: [
			{
				selector: '#onetrust-accept-btn-handler, button[aria-label="Accept all cookies"]',
				timeoutMs: 1_500,
			},
		],
		extraHTTPHeaders: { "accept-language": "en-GB,en;q=0.9" },
		hideWebdriver: true,
		viewport: { width: 1740, height: 1008 },
		javaScriptEnabled: true,
		navigationTimeoutMs: 60_000,
		runtimeQuietMs: 2_000,
		scroll: DEFAULT_PROGRESSIVE_SCROLL,
		screenshot: { type: "png", fullPage: true },
		thumbnail: { type: "jpeg", quality: 72 },
		userAgent: DESKTOP_USER_AGENT,
		userAgentMetadata: {
			architecture: "x86",
			brands: CHROME_BRANDS,
			fullVersionList: CHROME_FULL_VERSIONS,
			mobile: false,
			model: "",
			platform: "macOS",
			platformVersion: "15.0.0",
		},
		waitForImagesMs: 5_000,
		hideSelectors: GENERIC_CONSENT_SELECTORS,
	},
	mobile: {
		clickActions: [
			{
				selector: '#onetrust-accept-btn-handler, button[aria-label="Accept all cookies"]',
				timeoutMs: 1_500,
			},
		],
		extraHTTPHeaders: { "accept-language": "en-GB,en;q=0.9" },
		viewport: { width: 412, height: 915 },
		deviceScaleFactor: 2.625,
		hasTouch: true,
		hideWebdriver: true,
		isMobile: true,
		javaScriptEnabled: true,
		navigationTimeoutMs: 60_000,
		runtimeQuietMs: 2_000,
		scroll: DEFAULT_PROGRESSIVE_SCROLL,
		screenshot: { type: "png", fullPage: true },
		thumbnail: { type: "jpeg", quality: 72 },
		userAgent: MOBILE_USER_AGENT,
		userAgentMetadata: {
			architecture: "arm",
			brands: CHROME_BRANDS,
			fullVersionList: CHROME_FULL_VERSIONS,
			mobile: true,
			model: "Pixel 8",
			platform: "Android",
			platformVersion: "14.0.0",
		},
		waitForImagesMs: 5_000,
		hideSelectors: GENERIC_CONSENT_SELECTORS,
	},
};

const CHALLENGE_SELECTORS: BlockSelector[] = [
	{ selector: "#challenge-running", reason: "cloudflare-challenge" },
	{ selector: '[data-testid="captcha"]', reason: "captcha" },
];

const PROFILES: Record<string, CaptureProfile> = {
	default: {
		provider: "cloudflare",
	},
	bbc: {
		deviceConfig: {
			desktop: {
				cookies: [
					{ name: "ckns_policy", value: "111", url: "https://www.bbc.com" },
					{ name: "ckns_explicit", value: "1", url: "https://www.bbc.com" },
					{ name: "ckns_policy", value: "111", url: "https://www.bbc.co.uk" },
					{ name: "ckns_explicit", value: "1", url: "https://www.bbc.co.uk" },
				],
				hideSelectors: [
					".ssrcss-1tm3b0g-SignInBannerWrapper",
					'[class*="MenuListContainer"]',
					'[class*="MoreMenuWrapper"]',
				],
				responseOverrides: [BBC_USERINFO_OVERRIDE],
			},
			mobile: {
				cookies: [
					{ name: "ckns_policy", value: "111", url: "https://www.bbc.com" },
					{ name: "ckns_explicit", value: "1", url: "https://www.bbc.com" },
					{ name: "ckns_policy", value: "111", url: "https://www.bbc.co.uk" },
					{ name: "ckns_explicit", value: "1", url: "https://www.bbc.co.uk" },
				],
				hideSelectors: [
					".ssrcss-1tm3b0g-SignInBannerWrapper",
					'[class*="MenuListContainer"]',
					'[class*="MoreMenuWrapper"]',
				],
				responseOverrides: [BBC_USERINFO_OVERRIDE],
			},
		},
	},
	guardian: {
		deviceConfig: forBothDevices({
			clickActions: [
				{
					frameUrlIncludes: ["sourcepoint.theguardian.com"],
					selector: 'button[title="Accept all"]',
					timeoutMs: 5_000,
					waitAfterMs: 1_000,
				},
			],
			scroll: { ...DEFAULT_PROGRESSIVE_SCROLL, behavior: "auto" },
		}),
	},
	sky: {
		deviceConfig: {
			desktop: {
				blockSelectors: CHALLENGE_SELECTORS,
				clickActions: [
					{
						frameUrlIncludes: ["consent", "privacy"],
						selector: 'button[title="Accept all"]',
						timeoutMs: 5_000,
					},
				],
				hideSelectors: [".ui-news-header-nav"],
				styles: [".ui-news-header-body { height: 50px !important; }"],
				waitAfterLoadMs: 5_000,
			},
			mobile: {
				blockSelectors: CHALLENGE_SELECTORS,
				clickActions: [
					{
						frameUrlIncludes: ["consent", "privacy"],
						selector: 'button[title="Accept all"]',
						timeoutMs: 5_000,
					},
				],
				hideSelectors: [".ui-news-header-nav"],
				styles: [".ui-news-header-body { height: 50px !important; }"],
				waitAfterLoadMs: 5_000,
			},
		},
	},
	skysports: {
		deviceConfig: forBothDevices({
			blockSelectors: CHALLENGE_SELECTORS,
			waitAfterLoadMs: 5_000,
		}),
	},
	times: {
		deviceConfig: forBothDevices({
			hideSelectors: ['div[id^="sp_message_container_"]', 'iframe[id^="sp_message_iframe_"]'],
			styles: ["html.sp-message-open { overflow: auto !important; }"],
		}),
		failureIndicators: [
			{ reason: "device-verification", text: "verifying your device" },
			{ reason: "device-verification", text: "verification failed. please try again" },
		],
	},
	telegraph: {
		deviceConfig: {
			desktop: {
				blockSelectors: [{ selector: "#sec-if-cpt-container", reason: "akamai-challenge" }],
				clickActions: [
					{
						frameUrlIncludes: ["consent", "privacy"],
						selector: 'button[title="I Accept"]',
						timeoutMs: 5_000,
					},
					{ selector: "button.martech-spotlight-modal__close-button", timeoutMs: 1_000 },
				],
			},
			mobile: {
				blockSelectors: [{ selector: "#sec-if-cpt-container", reason: "akamai-challenge" }],
				clickActions: [
					{
						frameUrlIncludes: ["consent", "privacy"],
						selector: 'button[title="I Accept"]',
						timeoutMs: 5_000,
					},
					{ selector: "button.martech-spotlight-modal__close-button", timeoutMs: 1_000 },
				],
			},
		},
	},
	bloomberg: {
		deviceConfig: {
			desktop: {
				clickActions: [
					{
						selector: '#cmp-consent-button, button[aria-label="Dismiss banner"]',
					},
					{
						frameUrlIncludes: ["consent", "privacy"],
						selector: 'button[title="No, I Do Not Accept"]',
						timeoutMs: 5_000,
					},
				],
				blockSelectors: [
					{ selector: "#px-captcha", reason: "captcha" },
					{ selector: ".challenge-form", reason: "challenge" },
				],
				hideSelectors: [
					"#cmp-consent-modal",
					"#fortress-container-root",
					".grecaptcha-badge",
					'[data-testid="dismissible-banner"]',
					'div[class*="media-ui-FullWidthAd_fullWidthAdWrapper"]',
					'div[id^="sp_message_container_"]',
					'iframe[id^="sp_message_iframe_"]',
				],
				styles: ["html.sp-message-open { overflow: auto !important; }"],
				viewport: { width: 1920, height: 1080 },
				waitAfterLoadMs: 3_000,
			},
			mobile: {
				blockSelectors: [{ selector: "#px-captcha", reason: "captcha" }],
				clickActions: [
					{
						selector: '#cmp-consent-button, button[aria-label="Dismiss banner"]',
					},
					{
						frameUrlIncludes: ["consent", "privacy"],
						selector: 'button[title="No, I Do Not Accept"]',
						timeoutMs: 5_000,
					},
				],
				hideSelectors: [
					"#cmp-consent-modal",
					"#fortress-container-root",
					".grecaptcha-badge",
					'[data-testid="dismissible-banner"]',
					'div[class*="media-ui-FullWidthAd_fullWidthAdWrapper"]',
					'div[id^="sp_message_container_"]',
					'iframe[id^="sp_message_iframe_"]',
				],
				styles: ["html.sp-message-open { overflow: auto !important; }"],
				waitAfterLoadMs: 3_000,
			},
		},
		failureIndicators: [
			{ reason: "security-systems", text: "security systems have detected" },
			{ reason: "tollbit-token", text: "valid tollbit token" },
		],
	},
	reach: {
		deviceConfig: forBothDevices({
			hideSelectors: [
				"#qc-cmp2-container",
				".qc-cmp-cleanslate",
				"#div-gpt-ad-top-slot",
				"#div-gpt-ad-ad-mix-slot",
				"#div-gpt-ad-ad-web-strip",
			],
		}),
	},
	newsquest: {
		deviceConfig: {
			desktop: {
				clickActions: [
					{
						frameUrlIncludes: ["consent", "privacy-mgmt.com"],
						selector: 'button[title="Reject All"], button[title="Accept All"]',
						timeoutMs: 5_000,
					},
				],
				hideSelectors: [
					'div[id^="sp_message_container_"]',
					'iframe[id^="sp_message_iframe_"]',
					"#premium_mpu_container",
					"#standard_mpu_1_container",
					"#standard_mpu_2_container",
					"#high_vis_container",
					"#module-content .block-article-shoutout",
				],
				styles: [
					"html, body { height: auto !important; max-height: none !important; overflow-y: auto !important; }",
				],
			},
			mobile: {
				clickActions: [
					{
						frameUrlIncludes: ["consent", "privacy-mgmt.com"],
						selector: 'button[title="Reject All"], button[title="Accept All"]',
						timeoutMs: 5_000,
					},
				],
				hideSelectors: [
					'div[id^="sp_message_container_"]',
					'iframe[id^="sp_message_iframe_"]',
					"#premium_mpu_container",
					"#standard_mpu_1_container",
					"#standard_mpu_2_container",
					"#high_vis_container",
					"#module-content .block-article-shoutout",
				],
				styles: [
					"html, body { height: auto !important; max-height: none !important; overflow-y: auto !important; }",
				],
			},
		},
	},
	itv: {
		deviceConfig: forBothDevices({
			clickActions: [{ selector: "button.cassie-pre-banner--button.cassie-accept-all" }],
			hideSelectors: ["#cassie-widget"],
		}),
	},
	metro: {
		deviceConfig: {
			desktop: {
				clickActions: [
					{
						selector: METRO_CONSENT_SELECTOR,
						timeoutMs: 5_000,
					},
				],
				hideSelectors: METRO_CONSENT_HIDE_SELECTORS,
			},
			mobile: {
				clickActions: [
					{
						selector: METRO_CONSENT_SELECTOR,
						timeoutMs: 5_000,
					},
				],
				hideSelectors: METRO_CONSENT_HIDE_SELECTORS,
			},
		},
	},
	stv: {
		deviceConfig: forBothDevices({ hideSelectors: ["#cassie-widget"] }),
	},
	dailymail: {
		deviceConfig: {
			desktop: {
				clickActions: [
					{
						frameUrlIncludes: ["cmp.dmgmediaprivacy.co.uk"],
						selector: [
							'button[aria-label="Accept all"]',
							'button[title="Accept all"]',
							'button[data-testid="accept-all"]',
						].join(", "),
						timeoutMs: 5_000,
					},
				],
				hideSelectors: [
					".billboard-container",
					'[data-project="mol-fe-cmp"]',
					'iframe[src^="https://cmp.dmgmediaprivacy.co.uk/"]',
				],
			},
			mobile: {
				clickActions: [
					{
						frameUrlIncludes: ["cmp.dmgmediaprivacy.co.uk"],
						selector: [
							'button[aria-label="Accept all"]',
							'button[title="Accept all"]',
							'button[data-testid="accept-all"]',
						].join(", "),
						timeoutMs: 5_000,
					},
				],
				hideSelectors: [
					".billboard-container",
					'[data-project="mol-fe-cmp"]',
					'iframe[src^="https://cmp.dmgmediaprivacy.co.uk/"]',
				],
			},
		},
	},
	belfasttelegraph: {
		deviceConfig: forBothDevices({ hideSelectors: ["#didomi-popup"] }),
	},
	financialtimes: {
		deviceConfig: {
			desktop: {
				clickActions: [
					{
						frameUrlIncludes: ["consent", "privacy"],
						selector: 'button[title="Reject"]',
						timeoutMs: 5_000,
					},
				],
				hideSelectors: [".slot-wrapper", ".o-banner"],
			},
			mobile: {
				clickActions: [
					{
						frameUrlIncludes: ["consent", "privacy"],
						selector: 'button[title="Reject"]',
						timeoutMs: 5_000,
					},
				],
				hideSelectors: [".slot-wrapper", ".o-banner"],
			},
		},
	},
	independent: {
		deviceConfig: {
			desktop: {
				clickActions: [
					{
						frameUrlIncludes: ["consent", "privacy"],
						selector: 'button[title="ACCEPT"], button[aria-label="ACCEPT"]',
						timeoutMs: 5_000,
					},
				],
			},
			mobile: {
				clickActions: [
					{
						frameUrlIncludes: ["consent", "privacy"],
						selector: 'button[title="ACCEPT"], button[aria-label="ACCEPT"]',
						timeoutMs: 5_000,
					},
				],
			},
		},
	},
	givemesport: {
		deviceConfig: {
			desktop: {
				clickActions: [
					{
						frameUrlIncludes: ["consent", "privacy"],
						selector: 'button[title="Accept All"]',
						timeoutMs: 5_000,
					},
				],
			},
			mobile: {
				clickActions: [
					{
						frameUrlIncludes: ["consent", "privacy"],
						selector: 'button[title="Accept All"]',
						timeoutMs: 5_000,
					},
				],
			},
		},
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
		clickActions: [...(base.clickActions ?? []), ...(overrides?.clickActions ?? [])],
		cookies: [...(base.cookies ?? []), ...(overrides?.cookies ?? [])],
		extraHTTPHeaders: { ...base.extraHTTPHeaders, ...overrides?.extraHTTPHeaders },
		hideSelectors: [...(base.hideSelectors ?? []), ...(overrides?.hideSelectors ?? [])],
		responseOverrides: [...(base.responseOverrides ?? []), ...(overrides?.responseOverrides ?? [])],
		styles: [...(base.styles ?? []), ...(overrides?.styles ?? [])],
		viewport: overrides?.viewport ?? base.viewport,
	};
}

export function resolveCaptureProfile(site: SiteDefinition): ResolvedCaptureProfile {
	const profile = PROFILES[site.profile ?? site.brand] ?? PROFILES.default;
	return {
		devices: profile.devices ?? ["desktop", "mobile"],
		deviceConfig: {
			desktop: mergeDeviceConfig(DEFAULT_DEVICE_CONFIG.desktop, profile.deviceConfig?.desktop),
			mobile: mergeDeviceConfig(DEFAULT_DEVICE_CONFIG.mobile, profile.deviceConfig?.mobile),
		},
		failureIndicators: [...FAILURE_INDICATORS, ...(profile.failureIndicators ?? [])],
		provider: site.provider ?? profile.provider ?? "cloudflare",
	};
}
