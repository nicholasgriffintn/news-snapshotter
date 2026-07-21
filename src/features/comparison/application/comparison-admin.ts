import { InvalidInputError } from "../../../core/errors.ts";
import { jsonRecord } from "../../../core/json.ts";
import type { Env } from "../../../platform/cloudflare/env.ts";
import { readBoundedJson } from "../../../core/request.ts";
import {
	captureAnalysisIdentities,
	listAnalysisFeedback,
	listAnalysisRuns,
	resolveAnalysisFeedback,
	withdrawStoryRevision,
} from "../infrastructure/comparison-admin-repository.ts";
import { COMPARISON_PIPELINE } from "../domain/pipeline.ts";

const RUN_STATUSES = new Set(["abstained", "failed", "pending", "running", "stale", "succeeded"]);
const FEEDBACK_STATUSES = new Set(["dismissed", "pending", "resolved"]);

function bodyRecord(value: unknown): Record<string, unknown> {
	const body = jsonRecord(value);
	if (!body) {
		throw new InvalidInputError("Request body must be a JSON object");
	}
	return body;
}

function requeueCaptureIds(body: Record<string, unknown>): string[] {
	if (
		Object.keys(body).some((key) => !["captureId", "captureIds"].includes(key)) ||
		(body.captureId !== undefined && body.captureIds !== undefined)
	) {
		throw new InvalidInputError("capture identifiers are invalid");
	}

	const values: unknown[] =
		typeof body.captureId === "string"
			? [body.captureId]
			: Array.isArray(body.captureIds)
				? body.captureIds
				: [];
	if (
		values.length < 1 ||
		values.length > 100 ||
		!values.every(
			(value): value is string =>
				typeof value === "string" && value.length > 0 && value.length <= 200,
		) ||
		new Set(values).size !== values.length
	) {
		throw new InvalidInputError("capture identifiers are invalid");
	}

	return values;
}

export async function handleComparisonAdminRequest(
	request: Request,
	env: Env,
): Promise<Response | null> {
	const url = new URL(request.url);
	if (request.method === "GET" && url.pathname === "/api/admin/comparison/runs") {
		const rawLimit = url.searchParams.get("limit");
		const limit = rawLimit === null ? 50 : Number(rawLimit);
		const status = url.searchParams.get("status") ?? undefined;
		if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
			throw new InvalidInputError("limit must be between 1 and 100");
		}
		if (status && !RUN_STATUSES.has(status)) {
			throw new InvalidInputError("status is invalid");
		}
		return Response.json({ runs: await listAnalysisRuns(env.HISTORY_DB, { limit, status }) });
	}
	if (request.method === "GET" && url.pathname === "/api/admin/comparison/feedback") {
		const rawLimit = url.searchParams.get("limit");
		const limit = rawLimit === null ? 50 : Number(rawLimit);
		const status = url.searchParams.get("status") ?? "pending";
		if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
			throw new InvalidInputError("limit must be between 1 and 100");
		}
		if (!FEEDBACK_STATUSES.has(status)) {
			throw new InvalidInputError("status is invalid");
		}
		return Response.json({
			feedback: await listAnalysisFeedback(env.HISTORY_DB, { limit, status }),
		});
	}
	if (request.method === "POST" && url.pathname === "/api/admin/comparison/requeue") {
		const body = bodyRecord(await readBoundedJson(request, 2_048));
		const captureIds = requeueCaptureIds(body);
		const captures = await captureAnalysisIdentities(env.HISTORY_DB, captureIds);
		if (captures.length !== captureIds.length) {
			return Response.json(
				{
					code: "capture_not_found",
					message: "One or more captures were not found",
					status: "error",
				},
				{ status: 404 },
			);
		}
		for (const capture of captures) {
			await env.ANALYSIS_QUEUE.send({
				captureId: capture.captureId,
				contentHash: capture.contentHash,
				finaliseAfterAnalysis: true,
				kind: "analyse-capture",
			});
		}
		return Response.json(
			{
				captureIds,
				pipelineVersion: COMPARISON_PIPELINE.pipelineVersion,
				status: "queued",
			},
			{ status: 202 },
		);
	}
	const withdrawal = /^\/api\/admin\/comparison\/revisions\/([^/]+)\/withdraw$/.exec(url.pathname);
	if (request.method === "POST" && withdrawal) {
		const revisionId = decodeURIComponent(withdrawal[1]);
		const body = bodyRecord(await readBoundedJson(request, 2_048));
		if (
			Object.keys(body).some((key) => key !== "reason") ||
			typeof body.reason !== "string" ||
			body.reason.trim().length < 5 ||
			body.reason.length > 500
		) {
			throw new InvalidInputError("reason must be between 5 and 500 characters");
		}
		const withdrawn = await withdrawStoryRevision(env.HISTORY_DB, revisionId, body.reason.trim());
		return withdrawn
			? Response.json({ revisionId, status: "withdrawn" })
			: Response.json(
					{ code: "revision_not_found", message: "Revision not found", status: "error" },
					{ status: 404 },
				);
	}
	const feedbackResolution = /^\/api\/admin\/comparison\/feedback\/([^/]+)\/resolve$/.exec(
		url.pathname,
	);
	if (request.method === "POST" && feedbackResolution) {
		const feedbackId = decodeURIComponent(feedbackResolution[1]);
		const body = bodyRecord(await readBoundedJson(request, 2_048));
		if (
			Object.keys(body).some((key) => !["resolution", "status"].includes(key)) ||
			typeof body.resolution !== "string" ||
			body.resolution.trim().length < 5 ||
			body.resolution.length > 1_000 ||
			(body.status !== "dismissed" && body.status !== "resolved")
		) {
			throw new InvalidInputError("Feedback resolution is invalid");
		}
		const resolved = await resolveAnalysisFeedback(env.HISTORY_DB, feedbackId, {
			resolution: body.resolution.trim(),
			status: body.status,
		});
		return resolved
			? Response.json({ feedbackId, status: body.status })
			: Response.json(
					{ code: "feedback_not_found", message: "Feedback not found", status: "error" },
					{ status: 404 },
				);
	}
	return null;
}
