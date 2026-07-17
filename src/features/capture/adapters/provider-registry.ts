import puppeteer, {
	connect,
	type Browser,
	type Page,
} from "@cloudflare/puppeteer";

import type { DeviceCaptureConfig } from "../domain/profiles.ts";
import type { Env } from "../../../platform/cloudflare/env.ts";
import type {
	CaptureProviderName,
	Device,
	SiteDefinition,
} from "../../../core/domain.ts";

export const CAPTURE_PROVIDER_NAMES: CaptureProviderName[] = [
	"cloudflare",
	"hyperbrowser",
];

export type CaptureBrowserSession = {
	close: () => Promise<void>;
	page: Page;
};

type ProviderContext = {
	config: DeviceCaptureConfig;
	device: Device;
	env: Pick<Env, "BROWSER" | "HYPERBROWSER_API_KEY">;
	site: SiteDefinition;
};

type CaptureProvider = {
	managesFingerprint: boolean;
	open: (context: ProviderContext) => Promise<CaptureBrowserSession>;
};

type HyperbrowserClient = {
	sessions: {
		create: (
			params: HyperbrowserSessionParams,
		) => Promise<{
			id: string;
			wsEndpoint: string;
		}>;
		stop: (sessionId: string) => Promise<unknown>;
	};
};

type HyperbrowserSessionParams = {
	acceptCookies: boolean;
	adblock: boolean;
	annoyances: boolean;
	device: Array<"desktop" | "mobile">;
	locales: string[];
	operatingSystems: Array<"android" | "macos">;
	platform: Array<"chrome">;
	proxyCountry?: "GB" | "US";
	region: "europe-west" | "us-east";
	screen: {
		height: number;
		width: number;
	};
	timeoutMinutes: number;
	trackers: boolean;
	useProxy: boolean;
	useStealth: boolean;
};

type HyperbrowserSession = {
	id: string;
	wsEndpoint: string;
};

type Fetcher = (
	input: string,
	init?: RequestInit,
) => Promise<Response>;

const HYPERBROWSER_MINIMUM_SCREEN_SIZE = 500;

type BrowserConnector = (
	wsEndpoint: string,
) => Promise<Browser>;

function hyperbrowserLocation(
	site: SiteDefinition,
): Pick<HyperbrowserSessionParams, "proxyCountry" | "region" | "useProxy"> {
	if (site.captureRegion === "uk") {
		return {
			region: "europe-west",
			useProxy: false,
		};
	}

	if (site.captureRegion === "us") {
		return {
			region: "us-east",
			useProxy: false,
		};
	}

	return {
		region: "europe-west",
		useProxy: false,
	};
}

function hyperbrowserDevice(
	device: Device,
): Pick<
	HyperbrowserSessionParams,
	"device" | "operatingSystems" | "platform"
> {
	if (device === "mobile") {
		return {
			device: ["mobile"],
			operatingSystems: ["android"],
			platform: ["chrome"],
		};
	}

	return {
		device: ["desktop"],
		operatingSystems: ["macos"],
		platform: ["chrome"],
	};
}

async function hyperbrowserRequest<T>(
	apiKey: string,
	fetcher: Fetcher,
	path: string,
	init: RequestInit,
): Promise<T> {
	const response = await fetcher(
		`https://api.hyperbrowser.ai/api${path}`,
		{
			...init,
			headers: {
				"content-type": "application/json",
				"x-api-key": apiKey,
			},
		},
	);

	if (!response.ok) {
		const body = await response.json().catch(() => null) as {
			error?: string;
			message?: string;
		} | null;
		const message = body?.message ?? body?.error ?? `HTTP ${response.status}`;

		throw new Error(`[Hyperbrowser]: ${message}`);
	}
	if (
		response.status === 204
		|| response.headers.get("content-length") === "0"
	) {
		return undefined as T;
	}

	return response.json() as Promise<T>;
}

export function createHyperbrowserClient(
	apiKey: string,
	fetcher: Fetcher = fetch,
): HyperbrowserClient {
	return {
		sessions: {
			create: async (params) => {
				return hyperbrowserRequest<HyperbrowserSession>(
					apiKey,
					fetcher,
					"/session",
					{
						body: JSON.stringify(params),
						method: "POST",
					},
				);
			},
			stop: async (sessionId) => {
				return hyperbrowserRequest<unknown>(
					apiKey,
					fetcher,
					`/session/${encodeURIComponent(sessionId)}/stop`,
					{
						method: "PUT",
					},
				);
			},
		},
	};
}

async function cloudflareProvider(
	context: ProviderContext,
): Promise<CaptureBrowserSession> {
	const browser = await puppeteer.launch(context.env.BROWSER);
	const page = await browser.newPage();

	return {
		close: async () => {
			await browser.close();
		},
		page,
	};
}

async function stopHyperbrowserSession(
	client: HyperbrowserClient,
	sessionId: string,
	browser?: Browser,
): Promise<void> {
	try {
		browser?.disconnect();
	} finally {
		await client.sessions.stop(sessionId);
	}
}

export async function openHyperbrowserCaptureBrowser(
	context: ProviderContext,
	client: HyperbrowserClient,
	connector: BrowserConnector,
): Promise<CaptureBrowserSession> {
	const session = await client.sessions.create({
		acceptCookies: true,
		adblock: true,
		annoyances: true,
		locales: ["en"],
		screen: {
			height: Math.max(
				context.config.viewport.height,
				HYPERBROWSER_MINIMUM_SCREEN_SIZE,
			),
			width: Math.max(
				context.config.viewport.width,
				HYPERBROWSER_MINIMUM_SCREEN_SIZE,
			),
		},
		timeoutMinutes: 10,
		trackers: true,
		useStealth: true,
		...hyperbrowserDevice(context.device),
		...hyperbrowserLocation(context.site),
	});
	let browser: Browser | undefined;

	try {
		browser = await connector(session.wsEndpoint);
		const contextPages = await browser.defaultBrowserContext().pages();
		const page = contextPages[0] ?? await browser.newPage();

		return {
			close: async () => {
				await stopHyperbrowserSession(
					client,
					session.id,
					browser,
				);
			},
			page,
		};
	} catch (error) {
		await stopHyperbrowserSession(
			client,
			session.id,
			browser,
		);
		throw error;
	}
}

async function hyperbrowserProvider(
	context: ProviderContext,
): Promise<CaptureBrowserSession> {
	const apiKey = context.env.HYPERBROWSER_API_KEY;

	if (!apiKey) {
		throw new Error("Hyperbrowser provider is not configured");
	}

	const client = createHyperbrowserClient(apiKey);

	return openHyperbrowserCaptureBrowser(
		context,
		client,
		async (wsEndpoint) => {
			return connect({
				browserWSEndpoint: wsEndpoint,
				defaultViewport: null,
			});
		},
	);
}

const PROVIDERS: Record<CaptureProviderName, CaptureProvider> = {
	cloudflare: {
		managesFingerprint: false,
		open: cloudflareProvider,
	},
	hyperbrowser: {
		managesFingerprint: true,
		open: hyperbrowserProvider,
	},
};

export function captureProviderManagesFingerprint(
	provider: CaptureProviderName,
): boolean {
	return PROVIDERS[provider].managesFingerprint;
}

export function hasCaptureProvider(
	provider: string,
): provider is CaptureProviderName {
	return CAPTURE_PROVIDER_NAMES.includes(provider as CaptureProviderName);
}

export async function openCaptureBrowser(
	provider: CaptureProviderName,
	context: ProviderContext,
): Promise<CaptureBrowserSession> {
	return PROVIDERS[provider].open(context);
}
