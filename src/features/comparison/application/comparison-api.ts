import { decodeCursor, encodeCursor } from "../../../core/cursor.ts";
import { InvalidInputError, PayloadTooLargeError } from "../../../core/errors.ts";
import { jsonRecord, parseJson } from "../../../core/json.ts";
import { readBoundedJson } from "../../../core/request.ts";
import type { Env } from "../../../platform/cloudflare/env.ts";
import { SITES } from "../../catalogue/domain/sites.ts";
import { COMPARISON_COHORTS, comparisonSites } from "../domain/configuration.ts";
import { recordComparisonFeedback } from "../infrastructure/comparison-admin-repository.ts";
import {
	getComparisonStory,
	getPublisherComparison,
	listComparisonStories,
	listComparisonStoryTopics,
	type ComparisonStoryCursor,
} from "../infrastructure/comparison-read-repository.ts";
import {
	listComparisonWindows,
	type ComparisonWindowCursor,
} from "../infrastructure/comparison-window-repository.ts";

type FeedbackReason = "incorrect" | "missing-context" | "other" | "unsupported";

const FEEDBACK_REASONS: readonly FeedbackReason[] = [
	"incorrect",
	"missing-context",
	"other",
	"unsupported",
];
const FEEDBACK_REASON_LABELS: Record<FeedbackReason, string> = {
	incorrect: "Incorrect finding",
	"missing-context": "Missing context",
	other: "Other",
	unsupported: "Not supported by evidence",
};

const DEFAULT_COHORT = COMPARISON_COHORTS[0]?.id ?? "";
const MAXIMUM_PERIOD_MS = 90 * 24 * 60 * 60_000;

function comparisonCohortId(url: URL): string {
	const cohort = url.searchParams.get("cohort") ?? DEFAULT_COHORT;
	if (!COMPARISON_COHORTS.some(({ id }) => id === cohort)) {
		throw new InvalidInputError("cohort is not configured");
	}

	return cohort;
}

function comparisonListLimit(url: URL): number {
	const raw = url.searchParams.get("limit");
	const value = raw === null ? 30 : Number(raw);
	if (!Number.isInteger(value) || value < 1 || value > 100) {
		throw new InvalidInputError("limit must be between 1 and 100");
	}

	return value;
}

function optionalComparisonDate(url: URL, key: string): string | undefined {
	const value = url.searchParams.get(key);
	if (value === null) {
		return undefined;
	}
	if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) {
		throw new InvalidInputError(`${key} must be an ISO timestamp`);
	}

	return new Date(value).toISOString();
}

function assertPeriod(from: string, to: string): void {
	const duration = Date.parse(to) - Date.parse(from);
	if (duration <= 0 || duration > MAXIMUM_PERIOD_MS) {
		throw new InvalidInputError("comparison period must be between one instant and 90 days");
	}
}

function publisherComparisonPeriod(url: URL): { from: string; to: string } {
	const to = optionalComparisonDate(url, "to") ?? new Date().toISOString();
	const period = url.searchParams.get("period");
	if (period && (url.searchParams.has("from") || url.searchParams.has("to"))) {
		throw new InvalidInputError("period cannot be combined with from or to");
	}
	const periodDays = period
		? ({ "24h": 1, "30d": 30, "7d": 7, "90d": 90 } as const)[period as "24h" | "30d" | "7d" | "90d"]
		: undefined;
	if (period && !periodDays) {
		throw new InvalidInputError("publisher comparison period is invalid");
	}
	const from =
		optionalComparisonDate(url, "from") ??
		new Date(Date.parse(to) - (periodDays ?? 7) * 24 * 60 * 60_000).toISOString();
	assertPeriod(from, to);

	return { from, to };
}

function storyComparisonPeriod(url: URL): { from?: string; to?: string } {
	const from = optionalComparisonDate(url, "from");
	const to = optionalComparisonDate(url, "to");
	if (Boolean(from) !== Boolean(to)) {
		throw new InvalidInputError("from and to must be supplied together");
	}
	if (from && to) {
		assertPeriod(from, to);
	}

	return { from, to };
}

function optionalQueryIdentifier(url: URL, key: string): string | undefined {
	const value = url.searchParams.get(key)?.trim();
	if (!value) {
		return undefined;
	}
	if (value.length > 200) {
		throw new InvalidInputError(`${key} is invalid`);
	}

	return value;
}

function comparisonWindowCursor(url: URL): ComparisonWindowCursor | undefined {
	const raw = url.searchParams.get("cursor");
	if (!raw) {
		return undefined;
	}
	const cursor = decodeCursor(raw);
	if (!cursor.startsAt || !cursor.windowId) {
		throw new InvalidInputError("cursor is invalid");
	}

	return { startsAt: cursor.startsAt, windowId: cursor.windowId };
}

function comparisonStoryCursor(url: URL): ComparisonStoryCursor | undefined {
	const raw = url.searchParams.get("cursor");
	if (!raw) {
		return undefined;
	}
	const cursor = decodeCursor(raw);
	if (
		!cursor.lastSeenAt ||
		!cursor.maxProminence ||
		!cursor.sourceCount ||
		!cursor.storyId ||
		!Number.isInteger(Number(cursor.maxProminence)) ||
		!Number.isInteger(Number(cursor.sourceCount))
	) {
		throw new InvalidInputError("cursor is invalid");
	}

	return {
		lastSeenAt: cursor.lastSeenAt,
		maxProminence: cursor.maxProminence,
		sourceCount: cursor.sourceCount,
		storyId: cursor.storyId,
	};
}

function isFeedbackReason(value: unknown): value is FeedbackReason {
	return typeof value === "string" && FEEDBACK_REASONS.some((reason) => reason === value);
}

function parseComparisonFeedback(value: unknown): {
	evidenceId?: string;
	note?: string;
	reason: FeedbackReason;
	revisionId: string;
} {
	const body = jsonRecord(value);
	if (!body) {
		throw new InvalidInputError("Feedback must be a JSON object");
	}
	if (
		Object.keys(body).some(
			(key) => !["evidenceId", "note", "reason", "revisionId"].includes(key),
		) ||
		typeof body.revisionId !== "string" ||
		body.revisionId.length > 100 ||
		!isFeedbackReason(body.reason) ||
		(body.evidenceId !== undefined &&
			(typeof body.evidenceId !== "string" || body.evidenceId.length > 100)) ||
		(body.note !== undefined && (typeof body.note !== "string" || body.note.length > 1_000))
	) {
		throw new InvalidInputError("Feedback does not match the supported format");
	}

	return {
		evidenceId: typeof body.evidenceId === "string" ? body.evidenceId : undefined,
		note: typeof body.note === "string" ? body.note.trim() || undefined : undefined,
		reason: body.reason,
		revisionId: body.revisionId,
	};
}

function feedbackSourceUrl(request: Request): string | undefined {
	const referer = request.headers.get("referer");
	if (!referer || referer.length > 2_048) {
		return undefined;
	}

	try {
		const url = new URL(referer);
		return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
	} catch {
		return undefined;
	}
}

async function sendComparisonFeedbackEmail(
	env: Env,
	feedback: {
		evidenceId?: string;
		feedbackId: string;
		note?: string;
		reason: FeedbackReason;
		revisionId: string;
		sourceUrl?: string;
	},
): Promise<void> {
	const reason = FEEDBACK_REASON_LABELS[feedback.reason];
	await env.CONTACT_EMAIL.send({
		to: "pashi@nicholasgriffin.dev",
		from: "contact@email.pashi.app",
		subject: `Pashi comparison feedback: ${reason}`,
		text: [
			"New comparison feedback was submitted.",
			"",
			`Feedback ID: ${feedback.feedbackId}`,
			`Reason: ${reason}`,
			`Revision: ${feedback.revisionId}`,
			`Evidence: ${feedback.evidenceId ?? "Not specified"}`,
			`Page: ${feedback.sourceUrl ?? "Not available"}`,
			"Review queue: https://news-snapshotter.pashi.app/admin",
			"",
			"Note:",
			feedback.note ?? "No note supplied.",
		].join("\n"),
	});
}

function errorResponse(code: string, message: string, status: number): Response {
	return Response.json({ code, message, status: "error" }, { status });
}

function siteName(site: string): string {
	return SITES.find(({ name }) => name === site)?.displayName ?? site;
}

function archiveCaptureUrl(site: string, captureId: string): string {
	const capture = encodeURIComponent(captureId);
	return `/history/${encodeURIComponent(site)}?capture=${capture}&overlay=1`;
}

function withEtag(request: Request, response: Response, revisionId: string): Response {
	const etag = `W/"${revisionId}"`;
	if (request.headers.get("if-none-match") === etag) {
		return new Response(null, { status: 304, headers: { etag } });
	}
	const headers = new Headers(response.headers);
	headers.set("etag", etag);
	headers.set("cache-control", "public, max-age=60");
	return new Response(response.body, { headers, status: response.status });
}

async function windowsResponse(url: URL, env: Env): Promise<Response> {
	const result = await listComparisonWindows(env.HISTORY_DB, comparisonCohortId(url), {
		cursor: comparisonWindowCursor(url),
		from: optionalComparisonDate(url, "from"),
		limit: comparisonListLimit(url),
		to: optionalComparisonDate(url, "to"),
	});

	return Response.json({
		cursor: result.nextCursor ? encodeCursor(result.nextCursor) : undefined,
		windows: result.windows,
	});
}

async function storiesResponse(url: URL, env: Env): Promise<Response> {
	const period = storyComparisonPeriod(url);
	const cohortId = comparisonCohortId(url);
	const query = optionalQueryIdentifier(url, "q");
	const windowId = optionalQueryIdentifier(url, "window");
	const publishers = comparisonSites(SITES, cohortId)
		.map(({ name: site }) => ({ displayName: siteName(site), site }))
		.sort((left, right) => left.displayName.localeCompare(right.displayName));
	const queryPublishers = query
		? publishers
				.filter(({ displayName }) =>
					displayName.toLocaleLowerCase("en-GB").includes(query.toLocaleLowerCase("en-GB")),
				)
				.map(({ site }) => site)
		: undefined;
	const [result, topics] = await Promise.all([
		listComparisonStories(env.HISTORY_DB, {
			cohortId,
			cursor: comparisonStoryCursor(url),
			from: period.from,
			limit: comparisonListLimit(url),
			publisher: optionalQueryIdentifier(url, "publisher"),
			query,
			queryPublishers,
			topic: optionalQueryIdentifier(url, "topic"),
			to: period.to,
			windowId,
		}),
		listComparisonStoryTopics(env.HISTORY_DB, {
			cohortId,
			from: period.from,
			to: period.to,
			windowId,
		}),
	]);

	return Response.json({
		cursor: result.nextCursor ? encodeCursor(result.nextCursor) : undefined,
		facets: { publishers, topics },
		stories: result.stories.map((story) => ({
			...story,
			publishers: story.publishers.map((site) => ({
				displayName: siteName(site),
				site,
			})),
		})),
	});
}

async function storyResponse(
	request: Request,
	env: Env,
	storyId: string,
	revisionId?: string,
): Promise<Response> {
	if (!storyId || storyId.length > 100) {
		throw new InvalidInputError("story identifier is invalid");
	}
	if (revisionId !== undefined && (!revisionId || revisionId.length > 100)) {
		throw new InvalidInputError("revision identifier is invalid");
	}
	const story = await getComparisonStory(env.HISTORY_DB, storyId, revisionId);
	if (!story) {
		return errorResponse("story_not_found", "Story comparison was not found", 404);
	}
	const response = Response.json({
		commonGround: parseJson(story.revision.common_ground_json) ?? [],
		differences: parseJson(story.revision.differences_json) ?? [],
		evidence: story.evidence.map((item) => ({
			archiveUrl: archiveCaptureUrl(item.site, item.capture_id),
			captureId: item.capture_id,
			capturedAt: item.captured_at,
			category: item.category ?? undefined,
			displayName: siteName(item.site),
			evidenceId: item.evidence_id,
			headline: item.headline,
			lastSeenAt: item.last_seen_at,
			prominence: item.prominence ?? undefined,
			rank: item.rank,
			section: item.section ?? undefined,
			site: item.site,
			summary: item.summary ?? undefined,
			url: item.canonical_url ?? undefined,
		})),
		revision: {
			analysisStatus: story.revision.analysis_status,
			confidence: story.revision.confidence,
			createdAt: story.revision.created_at,
			evidenceCount: story.revision.evidence_count,
			revisionId: story.revision.revision_id,
			sourceCount: story.revision.source_count,
		},
		story: {
			firstSeenAt: story.revision.first_seen_at,
			label: story.revision.normalised_label,
			lastSeenAt: story.revision.last_seen_at,
			slug: story.revision.slug,
			storyId: story.revision.story_id,
			summary: story.revision.summary,
		},
		window: {
			analysedSites: story.revision.analysed_site_count,
			capturedSites: story.revision.captured_site_count,
			cohortId: story.revision.cohort_id,
			endsAt: story.revision.ends_at,
			expectedSites: story.revision.expected_site_count,
			startsAt: story.revision.starts_at,
			status: story.revision.window_status,
			windowId: story.revision.window_id,
		},
	});

	return withEtag(request, response, story.revision.revision_id);
}

async function publisherResponse(url: URL, env: Env, site: string): Promise<Response> {
	const cohort = comparisonCohortId(url);
	const configuredSite = comparisonSites(SITES, cohort).find(({ name }) => name === site);
	if (!configuredSite) {
		return errorResponse("publisher_not_found", "Publisher is not in this comparison cohort", 404);
	}
	const period = publisherComparisonPeriod(url);

	return Response.json({
		cohortId: cohort,
		displayName: siteName(site),
		publisher: await getPublisherComparison(env.HISTORY_DB, {
			cohortId: cohort,
			...period,
			site,
		}),
		site,
	});
}

async function feedbackResponse(request: Request, env: Env): Promise<Response> {
	const value = await readBoundedJson(request, 4_096);
	const body = parseComparisonFeedback(value);
	const ip = request.headers.get("cf-connecting-ip")?.slice(0, 64) || "unknown";
	const rateLimit = await env.COMPARISON_FEEDBACK_RATE_LIMIT.limit({ key: `comparison:${ip}` });
	if (!rateLimit.success) {
		return errorResponse("rate_limited", "Too many reports. Try again later.", 429);
	}
	const feedbackId = await recordComparisonFeedback(env.HISTORY_DB, {
		evidenceId: body.evidenceId,
		note: body.note,
		reason: body.reason,
		revisionId: body.revisionId,
	});
	if (!feedbackId) {
		return errorResponse("revision_not_found", "Analysis revision was not found", 404);
	}

	try {
		await sendComparisonFeedbackEmail(env, {
			evidenceId: body.evidenceId,
			feedbackId,
			note: body.note,
			reason: body.reason,
			revisionId: body.revisionId,
			sourceUrl: feedbackSourceUrl(request),
		});
	} catch {
		console.error("Comparison feedback email delivery failed", { feedbackId });
		return Response.json(
			{
				code: "notification_failed",
				feedbackId,
				message: "Feedback was saved, but the notification could not be sent.",
				status: "error",
			},
			{ status: 502 },
		);
	}

	return Response.json({ feedbackId, status: "success" }, { status: 202 });
}

export async function handleComparisonRequest(
	request: Request,
	env: Env,
): Promise<Response | null> {
	const url = new URL(request.url);
	if (!url.pathname.startsWith("/api/comparison/")) {
		return null;
	}
	try {
		if (request.method === "GET" && url.pathname === "/api/comparison/windows") {
			return await windowsResponse(url, env);
		}
		if (request.method === "GET" && url.pathname === "/api/comparison/stories") {
			return await storiesResponse(url, env);
		}

		const storyMatch = /^\/api\/comparison\/stories\/([^/]+)$/.exec(url.pathname);
		if (request.method === "GET" && storyMatch) {
			return await storyResponse(
				request,
				env,
				decodeURIComponent(storyMatch[1]),
				optionalQueryIdentifier(url, "revision"),
			);
		}
		const publisherMatch = /^\/api\/comparison\/publishers\/([^/]+)$/.exec(url.pathname);
		if (request.method === "GET" && publisherMatch) {
			return await publisherResponse(url, env, decodeURIComponent(publisherMatch[1]));
		}
		if (request.method === "POST" && url.pathname === "/api/comparison/feedback") {
			return await feedbackResponse(request, env);
		}
		return errorResponse("not_found", "Not found", 404);
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			return errorResponse("feedback_too_large", "Feedback is too large", 413);
		}
		if (error instanceof InvalidInputError) {
			return errorResponse("invalid_request", error.message, 400);
		}
		throw error;
	}
}
