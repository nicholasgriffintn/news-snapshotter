import {
	ANALYSIS_STALE_AFTER_MS,
	COMPARISON_PIPELINE,
	selectGenerationVariant,
	type GenerationVariant,
} from "../domain/pipeline.ts";
import type { AnnotationEvidenceBinding, CaptureAnnotation } from "../domain/annotation.ts";

export const CURRENT_CAPTURE_MEMBERSHIPS_CTE = `current_memberships AS (
	SELECT sm.*
	FROM story_memberships sm
	JOIN analysis_runs ar ON ar.run_id = sm.annotation_run_id
	WHERE sm.active = 1 AND ar.status = 'succeeded'
		AND ar.run_id = (
			SELECT latest.run_id
			FROM analysis_runs latest
			WHERE latest.capture_id = sm.capture_id
				AND latest.kind = 'capture-annotation'
				AND latest.status = 'succeeded'
			ORDER BY latest.pipeline_version DESC, latest.completed_at DESC, latest.run_id DESC
			LIMIT 1
		)
)`;

export async function storeAnalysisInput(
	bucket: R2Bucket,
	runId: string,
	value: unknown,
): Promise<string> {
	const key = `comparison/runs/${runId}/input.json`;

	if (!(await bucket.head(key))) {
		await bucket.put(key, JSON.stringify(value), {
			httpMetadata: { contentType: "application/json" },
		});
	}

	return key;
}

export async function storeAnalysisOutput(
	bucket: R2Bucket,
	runId: string,
	attempt: number,
	value: unknown,
): Promise<string> {
	const key = `comparison/runs/${runId}/output-attempt-${attempt}.json`;

	await bucket.put(key, JSON.stringify(value), {
		httpMetadata: { contentType: "application/json" },
	});

	return key;
}

export type AnalysisRunClaim = {
	attempt: number;
	disposition: "active" | "claimed" | "complete";
	runId: string;
};

export type AnalysisGenerationAllowance =
	| {
			allowed: true;
			failureCount: number;
			tokenCount: number;
	  }
	| {
			allowed: false;
			failureCount: number;
			reason: "failure-threshold" | "token-threshold";
			tokenCount: number;
	  };

export type CanaryGenerationAllowance = {
	allowed: boolean;
	canaryDegradedRate?: number;
	canaryRuns: number;
	primaryDegradedRate?: number;
	primaryRuns: number;
};

type ModelQualityRow = {
	degraded_count: number;
	model: string;
	run_count: number;
};

export async function canaryGenerationAllowance(
	database: D1Database,
	canaryModel: string,
	primaryModel: string,
	now = new Date(),
): Promise<CanaryGenerationAllowance> {
	const since = new Date(
		now.getTime() - COMPARISON_PIPELINE.canaryEvaluationHours * 60 * 60_000,
	).toISOString();
	const rows = await database
		.prepare(
			`SELECT
				ar.model,
				COUNT(*) AS run_count,
				SUM(CASE
					WHEN ar.status = 'failed' OR EXISTS (
						SELECT 1
						FROM story_revisions sr
						JOIN analysis_feedback af ON af.revision_id = sr.revision_id
						WHERE sr.run_id = ar.run_id AND af.review_status = 'resolved'
					) THEN 1 ELSE 0
				END) AS degraded_count
			FROM analysis_runs ar
			WHERE ar.model IN (?, ?)
				AND ar.status IN ('succeeded', 'failed', 'abstained')
				AND COALESCE(ar.completed_at, ar.started_at, ar.created_at) >= ?
			GROUP BY ar.model`,
		)
		.bind(canaryModel, primaryModel, since)
		.all<ModelQualityRow>();
	const canary = rows.results.find(({ model }) => model === canaryModel);
	const primary = rows.results.find(({ model }) => model === primaryModel);
	const canaryRuns = canary?.run_count ?? 0;
	const primaryRuns = primary?.run_count ?? 0;
	const canaryDegradedRate = canaryRuns ? (canary?.degraded_count ?? 0) / canaryRuns : undefined;
	const primaryDegradedRate = primaryRuns
		? (primary?.degraded_count ?? 0) / primaryRuns
		: undefined;
	const canaryHasEvidence = canaryRuns >= COMPARISON_PIPELINE.minimumCanaryRuns;
	const primaryHasEvidence = primaryRuns >= COMPARISON_PIPELINE.minimumCanaryRuns;
	let allowed = true;

	if (canaryHasEvidence && primaryHasEvidence) {
		allowed =
			(canaryDegradedRate ?? 0) <=
			(primaryDegradedRate ?? 0) + COMPARISON_PIPELINE.maximumCanaryRegression;
	} else if (canaryHasEvidence) {
		allowed =
			(canaryDegradedRate ?? 0) <= COMPARISON_PIPELINE.maximumCanaryDegradedRate;
	}

	return {
		allowed,
		canaryDegradedRate,
		canaryRuns,
		primaryDegradedRate,
		primaryRuns,
	};
}

export async function generationVariantForRun(
	database: D1Database,
	inputHash: string,
	configuration: { canaryModel?: string; canaryPercent?: string },
): Promise<GenerationVariant & { canarySuppressed: boolean }> {
	const selected = selectGenerationVariant(inputHash, configuration);
	if (selected.rollout === "primary") {
		return { ...selected, canarySuppressed: false };
	}
	const allowance = await canaryGenerationAllowance(
		database,
		selected.model,
		COMPARISON_PIPELINE.generationModel,
	);
	if (allowance.allowed) {
		return { ...selected, canarySuppressed: false };
	}

	return {
		canarySuppressed: true,
		model: COMPARISON_PIPELINE.generationModel,
		rollout: "primary",
	};
}

export async function analysisGenerationAllowance(
	database: D1Database,
	now = new Date(),
): Promise<AnalysisGenerationAllowance> {
	const since = new Date(
		now.getTime() - COMPARISON_PIPELINE.generationWindowMinutes * 60_000,
	).toISOString();
	const usage = await database
		.prepare(
			`SELECT
				SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failure_count,
				SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)) AS token_count
			FROM analysis_runs
			WHERE COALESCE(completed_at, started_at, created_at) >= ?`,
		)
		.bind(since)
		.first<{ failure_count: number | null; token_count: number | null }>();
	const failureCount = usage?.failure_count ?? 0;
	const tokenCount = usage?.token_count ?? 0;

	if (failureCount >= COMPARISON_PIPELINE.maxGenerationFailuresPerWindow) {
		return { allowed: false, failureCount, reason: "failure-threshold", tokenCount };
	}
	if (tokenCount >= COMPARISON_PIPELINE.maxTokensPerGenerationWindow) {
		return { allowed: false, failureCount, reason: "token-threshold", tokenCount };
	}

	return { allowed: true, failureCount, tokenCount };
}

async function claimAnalysisRun(
	database: D1Database,
	input: {
		captureId?: string;
		idempotencyKey: string;
		inputHash: string;
		kind: "capture-annotation" | "story-comparison";
		model: string;
		storyId?: string;
		windowId?: string;
	},
): Promise<AnalysisRunClaim> {
	const now = new Date().toISOString();
	const proposedRunId = crypto.randomUUID();
	await database
		.prepare(
			`INSERT INTO analysis_runs (
				run_id, idempotency_key, kind, capture_id, story_id, window_id, input_hash,
				pipeline_version, taxonomy_version, prompt_version, schema_version,
				model, status, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
			ON CONFLICT(idempotency_key) DO NOTHING`,
		)
		.bind(
			proposedRunId,
			input.idempotencyKey,
			input.kind,
			input.captureId ?? null,
			input.storyId ?? null,
			input.windowId ?? null,
			input.inputHash,
			COMPARISON_PIPELINE.pipelineVersion,
			COMPARISON_PIPELINE.taxonomyVersion,
			COMPARISON_PIPELINE.promptVersion,
			COMPARISON_PIPELINE.schemaVersion,
			input.model,
			now,
		)
		.run();
	const existing = await database
		.prepare(
			`SELECT run_id, status, attempt_count, input_hash, error_code
			FROM analysis_runs WHERE idempotency_key = ?`,
		)
		.bind(input.idempotencyKey)
		.first<{
			attempt_count: number;
			error_code: string | null;
			input_hash: string;
			run_id: string;
			status: string;
		}>();
	if (!existing || existing.input_hash !== input.inputHash) {
		throw new Error("Analysis run identity could not be claimed");
	}
	if (existing.status === "succeeded" || existing.status === "abstained") {
		return {
			attempt: existing.attempt_count,
			disposition: "complete",
			runId: existing.run_id,
		};
	}

	const staleBefore = new Date(Date.now() - ANALYSIS_STALE_AFTER_MS).toISOString();
	const claimed = await database
		.prepare(
			`UPDATE analysis_runs SET
				status = 'running', attempt_count = attempt_count + 1,
				started_at = ?, completed_at = NULL, error_code = NULL, error_message = NULL
			WHERE run_id = ? AND (
				status IN ('pending', 'failed') OR
				(status = 'running' AND COALESCE(started_at, created_at) < ?)
			)`,
		)
		.bind(now, existing.run_id, staleBefore)
		.run();

	if ((claimed.meta.changes ?? 0) === 0) {
		return {
			attempt: existing.attempt_count,
			disposition: "active",
			runId: existing.run_id,
		};
	}

	return {
		attempt: existing.attempt_count + 1,
		disposition: "claimed",
		runId: existing.run_id,
	};
}

export async function claimCaptureAnalysisRun(
	database: D1Database,
	input: { captureId: string; idempotencyKey: string; inputHash: string; model?: string },
): Promise<AnalysisRunClaim> {
	return claimAnalysisRun(database, {
		...input,
		kind: "capture-annotation",
		model: input.model ?? COMPARISON_PIPELINE.generationModel,
	});
}

export async function claimStoryComparisonRun(
	database: D1Database,
	input: {
		idempotencyKey: string;
		inputHash: string;
		model?: string;
		storyId: string;
		windowId: string;
	},
): Promise<AnalysisRunClaim> {
	return claimAnalysisRun(database, {
		...input,
		kind: "story-comparison",
		model: input.model ?? COMPARISON_PIPELINE.generationModel,
	});
}

export async function completeAnalysisRun(
	database: D1Database,
	runId: string,
	input: {
		aiGatewayLogId: string | null;
		inputR2Key: string;
		inputTokens?: number;
		outputR2Key: string;
		outputTokens?: number;
	},
): Promise<void> {
	await database
		.prepare(
			`UPDATE analysis_runs SET
				status = 'succeeded', input_tokens = ?, output_tokens = ?,
				ai_gateway_log_id = ?, input_r2_key = ?, output_r2_key = ?, completed_at = ?
			WHERE run_id = ?`,
		)
		.bind(
			input.inputTokens ?? null,
			input.outputTokens ?? null,
			input.aiGatewayLogId,
			input.inputR2Key,
			input.outputR2Key,
			new Date().toISOString(),
			runId,
		)
		.run();
}

export async function abstainAnalysisRun(
	database: D1Database,
	runId: string,
	code: string,
	message: string,
): Promise<void> {
	await database
		.prepare(
			`UPDATE analysis_runs SET status = 'abstained', error_code = ?, error_message = ?, completed_at = ?
			WHERE run_id = ?`,
		)
		.bind(code, message.slice(0, 20_000), new Date().toISOString(), runId)
		.run();
}

export async function failAnalysisRun(
	database: D1Database,
	runId: string,
	code: string,
	message: string,
): Promise<void> {
	await database
		.prepare(
			`UPDATE analysis_runs SET status = 'failed', error_code = ?, error_message = ?, completed_at = ?
			WHERE run_id = ?`,
		)
		.bind(code, message.slice(0, 20_000), new Date().toISOString(), runId)
		.run();
}

export async function replaceCaptureAnnotations(
	database: D1Database,
	runId: string,
	captureId: string,
	bindings: readonly AnnotationEvidenceBinding[],
	annotation: CaptureAnnotation,
): Promise<void> {
	const bindingByEvidence = new Map(
		bindings.map((binding) => [binding.evidence.evidenceId, binding]),
	);
	const statements: D1PreparedStatement[] = [
		database.prepare("DELETE FROM content_annotations WHERE run_id = ?").bind(runId),
	];
	for (const item of annotation.annotations) {
		const binding = bindingByEvidence.get(item.evidenceId);
		if (!binding) {
			throw new Error(`Annotation evidence binding not found: ${item.evidenceId}`);
		}
		statements.push(
			database
				.prepare(
					`INSERT INTO content_annotations (
						run_id, capture_id, placement_key, element_key, evidence_id,
						normalised_label, topics_json, entities_json, locations_json,
						framing_json, confidence
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					runId,
					captureId,
					binding.placementKey,
					binding.elementKey,
					item.evidenceId,
					item.normalisedLabel,
					JSON.stringify(item.topics),
					JSON.stringify(item.entities),
					JSON.stringify(item.locations),
					JSON.stringify(item.framing),
					item.confidence,
				),
		);
	}
	await database.batch(statements);
}
