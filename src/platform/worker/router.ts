import { SITES } from "../../features/catalogue/domain/sites.ts";
import { runBotCheck } from "../../features/capture/application/run-bot-check.ts";
import { listCaptureFailures } from "../../features/capture/infrastructure/capture-failures.ts";
import {
	CAPTURE_PROFILE_NAMES,
	hasCaptureProfile,
	resolveCaptureProfile,
} from "../../features/capture/domain/profiles.ts";
import { CAPTURE_PROVIDER_NAMES } from "../../features/capture/adapters/provider-registry.ts";
import { sendContactMessage } from "../../features/contact/application/send-contact-message.ts";
import type { Env } from "../cloudflare/env.ts";
import { isAuthorised } from "./auth.ts";
import { errorMessage, InvalidInputError } from "../../core/errors.ts";
import { thumbnailKey } from "../../core/storage-key.ts";
import {
	listScreenshots,
	screenshotImageUrl,
	serveScreenshot,
} from "../../features/archive/application/snapshots.ts";
import {
	parseCaptureSelection,
	startCaptureWorkflow,
} from "../../features/workflows/application/start-capture.ts";
import { handleHistoryRequest } from "../../features/history/application/history-api.ts";
import { handleHistoryAdminRequest } from "../../features/history/application/history-admin.ts";
import { handleHistoryResearchRequest } from "../../features/history/application/history-research-api.ts";
import { applyApiCachePolicy } from "./cache-control.ts";

const SITE_DISPLAY_NAMES = new Map<string, string>();
for (const site of SITES) {
	if (site.displayName) {
		SITE_DISPLAY_NAMES.set(site.name, site.displayName);
	}
}

function jsonError(message: string, status: number): Response {
	return Response.json({ status: "error", message }, { status });
}

async function readCaptureSelection(request: Request) {
	if (!request.headers.get("content-type")?.includes("application/json")) {
		return {};
	}
	return parseCaptureSelection(await request.json());
}

async function startBotCheck(request: Request, env: Env): Promise<Response> {
	const body: unknown = await request.json();
	if (!body || typeof body !== "object" || Array.isArray(body)) {
		throw new InvalidInputError("Bot check request must be a JSON object");
	}

	const { profile } = body as Record<string, unknown>;
	if (typeof profile !== "string" || !hasCaptureProfile(profile)) {
		throw new InvalidInputError("Choose a valid capture profile");
	}

	const result = await runBotCheck(env, profile);
	return Response.json({
		status: "success",
		...result,
		results: result.results.map((capture) => {
			return capture.key
				? {
						...capture,
						fullImageUrl: screenshotImageUrl(capture.key),
						thumbnailUrl: screenshotImageUrl(thumbnailKey(capture.key)),
					}
				: capture;
		}),
	});
}

function failureListOptions(url: URL): { cursor?: string; limit: number } {
	const cursor = url.searchParams.get("cursor") ?? undefined;
	const limitValue = url.searchParams.get("limit");
	const limit = limitValue === null ? 50 : Number(limitValue);
	if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
		throw new InvalidInputError("limit must be between 1 and 100");
	}
	if (cursor !== undefined && (cursor.length === 0 || cursor.length > 1_024)) {
		throw new InvalidInputError("cursor is invalid");
	}
	return { cursor, limit };
}

async function routeRequest(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);

	if (request.method === "GET" && url.pathname === "/api/screenshots") {
		return Response.json(await listScreenshots(env.SCREENSHOTS, SITE_DISPLAY_NAMES));
	}

	if (request.method === "GET" && url.pathname === "/api/screenshots/image") {
		return serveScreenshot(request, env);
	}

	if (request.method === "GET" && url.pathname === "/api/catalogue") {
		return Response.json({
			sites: SITES.map((site) => {
				return {
					brand: site.brand,
					captureRegion: site.captureRegion,
					category: site.category,
					displayName: site.displayName,
					name: site.name,
					priority: site.priority,
					provider: resolveCaptureProfile(site).provider,
				};
			}),
		});
	}

	if (request.method === "GET" && url.pathname === "/api/capture-providers") {
		return Response.json({
			providers: CAPTURE_PROVIDER_NAMES,
		});
	}

	if (request.method === "GET" && url.pathname === "/api/capture-profiles") {
		return Response.json({ profiles: CAPTURE_PROFILE_NAMES });
	}

	if (url.pathname.startsWith("/api/history/")) {
		if (!env.HISTORY_DB) {
			return jsonError("History storage is not configured", 503);
		}
		const researchResponse = await handleHistoryResearchRequest(request, env.HISTORY_DB);
		if (researchResponse) {
			return researchResponse;
		}
		const historyResponse = await handleHistoryRequest(request, env.HISTORY_DB);
		if (historyResponse) {
			return historyResponse;
		}
		return jsonError("Not found", 404);
	}

	if (request.method === "POST" && url.pathname === "/api/contact") {
		return sendContactMessage(request, env);
	}

	if (!isAuthorised(request.headers.get("authorization"), env.API_KEY)) {
		return jsonError("Invalid API key", 401);
	}

	if (request.method === "POST" && url.pathname === "/api/workflows") {
		const dispatch = await startCaptureWorkflow(env, await readCaptureSelection(request));
		return Response.json({ ...dispatch, status: "success" }, { status: 202 });
	}

	if (request.method === "POST" && url.pathname === "/api/admin/bot-checks") {
		return startBotCheck(request, env);
	}

	if (request.method === "GET" && url.pathname === "/api/admin/failures") {
		return Response.json(await listCaptureFailures(env, failureListOptions(url)));
	}

	if (url.pathname.startsWith("/api/admin/history/")) {
		const historyAdminResponse = await handleHistoryAdminRequest(request, env);
		if (historyAdminResponse) {
			return historyAdminResponse;
		}
	}

	if (request.method === "GET" && url.pathname.startsWith("/api/workflows/")) {
		const workflowId = url.pathname.slice("/api/workflows/".length);
		if (!workflowId) {
			return jsonError("Workflow ID is required", 400);
		}
		const instance = await env.NEWS_SNAPSHOTTER.get(workflowId);
		return Response.json({
			status: "success",
			workflowId,
			workflowStatus: await instance.status(),
		});
	}

	return jsonError("Not found", 404);
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
	let response: Response;

	try {
		response = await routeRequest(request, env);
	} catch (error) {
		if (error instanceof InvalidInputError) {
			response = jsonError(error.message, 400);
		} else if (error instanceof SyntaxError) {
			response = jsonError("Request body must be valid JSON", 400);
		} else if (error instanceof URIError) {
			response = jsonError("URL path is malformed", 400);
		} else {
			console.error("Request failed", { error: errorMessage(error) });
			response = jsonError("Internal server error", 500);
		}
	}

	return applyApiCachePolicy(
		request,
		response,
		isAuthorised(request.headers.get("authorization"), env.API_KEY),
	);
}
