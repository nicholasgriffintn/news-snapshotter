import { errorMessage } from "../../../core/errors.ts";
import { sha256 } from "../../../core/hash.ts";
import type { Env } from "../../../platform/cloudflare/env.ts";
import { SITES } from "../../catalogue/domain/sites.ts";
import { loadCaptureExtraction } from "../../history/infrastructure/history-capture-store.ts";
import {
	buildAnnotationEvidenceBindings,
	captureEmbeddingTexts,
	normaliseCaptureAnnotation,
} from "../domain/annotation.ts";
import { COMPARISON_COHORTS, comparisonSites } from "../domain/configuration.ts";
import {
	analysisIdempotencyKey,
	COMPARISON_PIPELINE,
	isRetryableAnalysisError,
	TerminalAnalysisError,
	TransientAnalysisError,
} from "../domain/pipeline.ts";
import {
	abstainAnalysisRun,
	analysisGenerationAllowance,
	claimCaptureAnalysisRun,
	completeAnalysisRun,
	failAnalysisRun,
	generationVariantForRun,
	replaceCaptureAnnotations,
	storeAnalysisInput,
	storeAnalysisOutput,
} from "../infrastructure/analysis-run-repository.ts";
import {
	ensureComparisonWindow,
	markWindowSite,
} from "../infrastructure/comparison-window-repository.ts";
import { clusterCaptureAnnotations } from "../infrastructure/story-cluster-repository.ts";
import { annotateHomepage, embedStoryEvidence } from "../infrastructure/workers-ai-analysis.ts";

type CaptureAnalysisEnv = Pick<
	Env,
	| "AI"
	| "ARCHIVE_DATA"
	| "COMPARISON_CANARY_MODEL"
	| "COMPARISON_CANARY_PERCENT"
	| "HISTORY_DB"
	| "STORY_VECTORS"
>;

type CaptureAnalysisWindow = {
	cohortId: string;
	windowId: string;
};

type CaptureAnalysisResult = {
	runId?: string;
	status: "abstained" | "skipped" | "succeeded";
	windows?: CaptureAnalysisWindow[];
};

export async function analyseCapture(
	env: CaptureAnalysisEnv,
	message: { captureId: string; contentHash: string },
): Promise<CaptureAnalysisResult> {
	const startedAt = Date.now();
	const document = await loadCaptureExtraction(env.HISTORY_DB, message.captureId);
	if (!document || document.contentHash !== message.contentHash) {
		throw new TerminalAnalysisError("Capture analysis message does not match indexed evidence");
	}
	const site = SITES.find(({ name }) => name === document.capture.site);
	if (!site?.comparison?.enabled) {
		return { status: "skipped" };
	}
	const bindings = buildAnnotationEvidenceBindings(document, site.comparison.maxHomepageItems);
	const evidence = bindings.map(({ evidence: item }) => item);
	const input = {
		capture: {
			captureId: document.capture.captureId,
			capturedAt: document.capture.capturedAt,
			site: document.capture.site,
		},
		evidence,
	};
	const inputHash = await sha256(JSON.stringify(input));
	const variant = await generationVariantForRun(env.HISTORY_DB, inputHash, {
		canaryModel: env.COMPARISON_CANARY_MODEL,
		canaryPercent: env.COMPARISON_CANARY_PERCENT,
	});
	if (variant.canarySuppressed) {
		console.warn(
			JSON.stringify({
				captureId: document.capture.captureId,
				event: "comparison-canary-suppressed",
				model: env.COMPARISON_CANARY_MODEL,
			}),
		);
	}
	const idempotencyKey = await analysisIdempotencyKey(
		inputHash,
		"capture-annotation",
		variant.model,
	);
	const claim = await claimCaptureAnalysisRun(env.HISTORY_DB, {
		captureId: document.capture.captureId,
		idempotencyKey,
		inputHash,
		model: variant.model,
	});
	if (claim.disposition === "complete") {
		return { runId: claim.runId, status: "skipped" };
	}
	if (claim.disposition === "active") {
		throw new TransientAnalysisError("Capture analysis is already active");
	}
	const windows = [];
	for (const cohortId of site.comparison.cohorts) {
		const cohort = COMPARISON_COHORTS.find(({ id }) => id === cohortId);
		if (!cohort) {
			throw new TerminalAnalysisError(`Unknown comparison cohort: ${cohortId}`);
		}
		const window = await ensureComparisonWindow(
			env.HISTORY_DB,
			cohort,
			comparisonSites(SITES, cohortId),
			document.capture.triggeredAt,
		);
		await markWindowSite(env.HISTORY_DB, window.windowId, site.name, "captured", {
			captureId: document.capture.captureId,
		});
		windows.push({ cohort, window });
	}
	if (evidence.length === 0) {
		await abstainAnalysisRun(
			env.HISTORY_DB,
			claim.runId,
			"no-editorial-evidence",
			"The capture contained no eligible editorial evidence",
		);
		console.log(
			JSON.stringify({
				attempt: claim.attempt,
				captureId: document.capture.captureId,
				durationMs: Date.now() - startedAt,
				event: "comparison-analysis-completed",
				runId: claim.runId,
				status: "abstained",
			}),
		);
		return {
			runId: claim.runId,
			status: "abstained",
			windows: windows.map(({ cohort, window }) => ({
				cohortId: cohort.id,
				windowId: window.windowId,
			})),
		};
	}
	const allowance = await analysisGenerationAllowance(env.HISTORY_DB);
	if (!allowance.allowed) {
		const message =
			`AI generation paused by ${allowance.reason}: ` +
			`${allowance.failureCount} failures and ${allowance.tokenCount} tokens in the current window`;
		await failAnalysisRun(env.HISTORY_DB, claim.runId, "analysis-circuit-open", message);
		throw new TransientAnalysisError(message);
	}

	try {
		const inputR2Key = await storeAnalysisInput(env.ARCHIVE_DATA, claim.runId, input);
		const model = await annotateHomepage(env.AI, evidence, variant.model);
		const annotation = normaliseCaptureAnnotation(model.output, bindings);
		await replaceCaptureAnnotations(
			env.HISTORY_DB,
			claim.runId,
			document.capture.captureId,
			bindings,
			annotation,
		);
		const embeddings = await embedStoryEvidence(
			env.AI,
			captureEmbeddingTexts(annotation, bindings),
		);
		const placementByEvidenceId = new Map(
			bindings.map(({ evidence: item, placementKey }) => [item.evidenceId, placementKey]),
		);
		for (const { cohort } of windows) {
			await clusterCaptureAnnotations({
				annotation,
				captureId: document.capture.captureId,
				capturedAt: document.capture.capturedAt,
				cohortId: cohort.id,
				database: env.HISTORY_DB,
				embeddings,
				language: cohort.language,
				placementByEvidenceId,
				runId: claim.runId,
				site: site.name,
				vectors: env.STORY_VECTORS,
			});
		}
		const outputR2Key = await storeAnalysisOutput(
			env.ARCHIVE_DATA,
			claim.runId,
			claim.attempt,
			annotation,
		);
		await completeAnalysisRun(env.HISTORY_DB, claim.runId, {
			aiGatewayLogId: model.aiGatewayLogId,
			inputR2Key,
			inputTokens: model.inputTokens,
			outputR2Key,
			outputTokens: model.outputTokens,
		});
		for (const { window } of windows) {
			await markWindowSite(env.HISTORY_DB, window.windowId, site.name, "analysed", {
				captureId: document.capture.captureId,
			});
		}
		console.log(
			JSON.stringify({
				attempt: claim.attempt,
				captureId: document.capture.captureId,
				durationMs: Date.now() - startedAt,
				event: "comparison-analysis-completed",
				inputTokens: model.inputTokens,
				model: variant.model,
				outputTokens: model.outputTokens,
				rollout: variant.rollout,
				runId: claim.runId,
				status: "succeeded",
			}),
		);
		return {
			runId: claim.runId,
			status: "succeeded",
			windows: windows.map(({ cohort, window }) => ({
				cohortId: cohort.id,
				windowId: window.windowId,
			})),
		};
	} catch (error) {
		const retryable = isRetryableAnalysisError(error);
		await failAnalysisRun(
			env.HISTORY_DB,
			claim.runId,
			retryable ? "analysis-transient" : "analysis-terminal",
			errorMessage(error),
		);
		for (const { window } of windows) {
			await markWindowSite(env.HISTORY_DB, window.windowId, site.name, "failed", {
				captureId: document.capture.captureId,
				failureReason: errorMessage(error),
			});
		}
		console.error(
			JSON.stringify({
				attempt: claim.attempt,
				captureId: document.capture.captureId,
				durationMs: Date.now() - startedAt,
				error: errorMessage(error),
				event: "comparison-analysis-completed",
				model: variant.model,
				rollout: variant.rollout,
				runId: claim.runId,
				status: "failed",
			}),
		);
		throw error;
	}
}
