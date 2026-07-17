import type {
	CaptureFailure,
	CapturePriority,
	CaptureProviderName,
	CatalogueSite,
	Snapshot,
} from "../core/types.ts";
import type { CaptureDispatch, CaptureSelection } from "../../core/contracts.ts";

async function readJson<T>(response: Response): Promise<T> {
	const body = (await response.json()) as T & { message?: string };
	if (!response.ok) {
		throw new Error(body.message ?? `Request failed with ${response.status}`);
	}
	return body;
}

export async function fetchSnapshots(): Promise<Snapshot[]> {
	const response = await fetch("/api/screenshots");
	return (await readJson<{ screenshots: Snapshot[] }>(response)).screenshots;
}

export async function fetchCatalogue(): Promise<CatalogueSite[]> {
	const response = await fetch("/api/catalogue");
	return (await readJson<{ sites: CatalogueSite[] }>(response)).sites;
}

export async function startSnapshotWorkflow(
	apiKey: string,
	selection: CaptureSelection,
): Promise<CaptureDispatch> {
	const response = await fetch("/api/workflows", {
		method: "POST",
		headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
		body: JSON.stringify(selection),
	});
	return readJson(response);
}

export async function fetchCaptureProviders(): Promise<CaptureProviderName[]> {
	const response = await fetch("/api/capture-providers");

	return (
		await readJson<{
			providers: CaptureProviderName[];
		}>(response)
	).providers;
}

export async function fetchCaptureProfiles(): Promise<string[]> {
	const response = await fetch("/api/capture-profiles");
	return (await readJson<{ profiles: string[] }>(response)).profiles;
}

export async function fetchCaptureFailures(
	apiKey: string,
	cursor?: string,
): Promise<{ cursor?: string; failures: CaptureFailure[]; hasMore: boolean }> {
	const search = new URLSearchParams({ limit: "50" });
	if (cursor) search.set("cursor", cursor);
	const response = await fetch(`/api/admin/failures?${search}`, {
		headers: { authorization: `Bearer ${apiKey}` },
	});
	return readJson(response);
}

export type BotCheckResult = {
	profile: string;
	results: Array<{
		capturedAt: string;
		device: "desktop" | "mobile";
		error?: string;
		fullImageUrl?: string;
		key?: string;
		status: "error" | "success";
		thumbnailUrl?: string;
		triggeredAt: string;
	}>;
	triggeredAt: string;
	url: string;
};

export async function startBotCheck(apiKey: string, profile: string): Promise<BotCheckResult> {
	const response = await fetch("/api/admin/bot-checks", {
		body: JSON.stringify({ profile }),
		headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
		method: "POST",
	});
	return readJson(response);
}

export async function sendContactMessage(message: {
	email: string;
	message: string;
	name: string;
	reason: "general" | "privacy" | "rights-holder";
	sourceUrl?: string;
	startedAt: number;
	website: string;
}): Promise<void> {
	const response = await fetch("/api/contact", {
		body: JSON.stringify(message),
		headers: { "content-type": "application/json" },
		method: "POST",
	});
	await readJson(response);
}
