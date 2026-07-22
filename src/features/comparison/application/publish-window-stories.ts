import { errorMessage } from "../../../core/errors.ts";
import { sha256 } from "../../../core/hash.ts";
import type { Env } from "../../../platform/cloudflare/env.ts";
import { SITES } from "../../catalogue/domain/sites.ts";
import { type StoryComparison, type StoryComparisonEvidence } from "../domain/story-comparison.ts";
import {
	analysisIdempotencyKey,
	COMPARISON_PIPELINE,
	isRetryableAnalysisError,
	prioritiseWindowStories,
	TransientAnalysisError,
} from "../domain/pipeline.ts";
import {
	analysisGenerationAllowance,
	claimStoryComparisonRun,
	generationVariantForRun,
	storeAnalysisInput,
	storeAnalysisOutput,
} from "../infrastructure/analysis-run-repository.ts";
import {
	listWindowStoryEvidence,
	saveStoryRevision,
	type StoryRevisionEvidence,
} from "../infrastructure/story-publication-repository.ts";
import { compareHomepageStory } from "../infrastructure/workers-ai-analysis.ts";

type StoryPublicationEnv = Pick<
	Env,
	"AI" | "ARCHIVE_DATA" | "COMPARISON_CANARY_MODEL" | "COMPARISON_CANARY_PERCENT" | "HISTORY_DB"
>;

const PUBLISHER_NAMES = new Map(
	SITES.map((site) => [
		site.name,
		[site.name, site.brand, site.displayName].filter((value): value is string => Boolean(value)),
	]),
);

function modelEvidence(item: StoryRevisionEvidence): StoryComparisonEvidence {
	return {
		category: item.category,
		entities: item.entities,
		evidenceId: item.evidenceId,
		framing: item.framing,
		headline: item.headline,
		prominence: item.prominence,
		rank: item.rank,
		section: item.section,
		summary: item.summary,
		topics: item.topics,
	};
}

function unavailableComparison(
	label: string,
	evidence: readonly StoryRevisionEvidence[],
): StoryComparison {
	return {
		commonGround: [],
		confidence: Math.min(...evidence.map(({ confidence }) => confidence)),
		differences: [],
		summary: label,
	};
}

export async function publishWindowStories(
	env: StoryPublicationEnv,
	input: { cohortId: string; windowId: string },
): Promise<number> {
	const eligibleStories = await listWindowStoryEvidence(
		env.HISTORY_DB,
		input.cohortId,
		input.windowId,
	);
	const stories = prioritiseWindowStories(
		eligibleStories,
		COMPARISON_PIPELINE.maxStoryComparisonsPerWindow,
	);
	if (eligibleStories.length > stories.length) {
		console.log(
			JSON.stringify({
				eligibleStories: eligibleStories.length,
				event: "comparison-window-generation-budget-applied",
				selectedStories: stories.length,
				windowId: input.windowId,
			}),
		);
	}
	const transientErrors: string[] = [];
	let published = 0;
	for (const story of stories) {
		if (story.evidence.length < 2) {
			continue;
		}
		const allowance = await analysisGenerationAllowance(env.HISTORY_DB);
		if (!allowance.allowed) {
			throw new TransientAnalysisError(
				`AI generation paused by ${allowance.reason}: ` +
					`${allowance.failureCount} failures and ${allowance.tokenCount} tokens ` +
					"in the current window",
			);
		}
		const evidence = story.evidence.map(modelEvidence);
		const modelInput = { evidence };
		const inputHash = await sha256(
			JSON.stringify({
				cohortId: input.cohortId,
				evidence: story.evidence,
				storyId: story.storyId,
				windowId: input.windowId,
			}),
		);
		const variant = await generationVariantForRun(env.HISTORY_DB, inputHash, {
			canaryModel: env.COMPARISON_CANARY_MODEL,
			canaryPercent: env.COMPARISON_CANARY_PERCENT,
		});
		if (variant.canarySuppressed) {
			console.warn(
				JSON.stringify({
					event: "comparison-canary-suppressed",
					model: env.COMPARISON_CANARY_MODEL,
					storyId: story.storyId,
					windowId: input.windowId,
				}),
			);
		}
		const idempotencyKey = await analysisIdempotencyKey(
			inputHash,
			"story-comparison",
			variant.model,
		);
		const claim = await claimStoryComparisonRun(env.HISTORY_DB, {
			idempotencyKey,
			inputHash,
			model: variant.model,
			storyId: story.storyId,
			windowId: input.windowId,
		});
		if (claim.disposition === "complete") {
			continue;
		}
		if (claim.disposition === "active") {
			throw new TransientAnalysisError("Story comparison analysis is already active");
		}
		const inputR2Key = await storeAnalysisInput(env.ARCHIVE_DATA, claim.runId, modelInput);
		try {
			const evidenceSites = new Map(
				story.evidence.map(({ evidenceId, site }) => [evidenceId, site]),
			);
			const publisherNames = [
				...new Set(story.evidence.flatMap(({ site }) => PUBLISHER_NAMES.get(site) ?? [site])),
			];
			const model = await compareHomepageStory(
				env.AI,
				evidence,
				evidenceSites,
				publisherNames,
				variant.model,
			);
			const outputR2Key = await storeAnalysisOutput(
				env.ARCHIVE_DATA,
				claim.runId,
				claim.attempt,
				model.output,
			);
			await saveStoryRevision({
				analysis: {
					aiGatewayLogId: model.aiGatewayLogId,
					inputR2Key,
					inputTokens: model.inputTokens,
					outputR2Key,
					outputTokens: model.outputTokens,
					status: "available",
				},
				bucket: env.ARCHIVE_DATA,
				cohortId: input.cohortId,
				comparison: model.output,
				database: env.HISTORY_DB,
				evidence: story.evidence,
				runId: claim.runId,
				storyId: story.storyId,
				windowId: input.windowId,
			});
			published += 1;
		} catch (error) {
			const message = errorMessage(error);
			const retryable = isRetryableAnalysisError(error);
			const fallback = unavailableComparison(story.label, story.evidence);
			const outputR2Key = await storeAnalysisOutput(env.ARCHIVE_DATA, claim.runId, claim.attempt, {
				error: message,
				status: "unavailable",
			});
			await saveStoryRevision({
				analysis: {
					aiGatewayLogId: null,
					errorCode: retryable ? "story-comparison-transient" : "story-comparison-terminal",
					errorMessage: message,
					inputR2Key,
					outputR2Key,
					status: "unavailable",
				},
				bucket: env.ARCHIVE_DATA,
				cohortId: input.cohortId,
				comparison: fallback,
				database: env.HISTORY_DB,
				evidence: story.evidence,
				runId: claim.runId,
				storyId: story.storyId,
				windowId: input.windowId,
			});
			published += 1;
			if (retryable) {
				transientErrors.push(message);
			}
		}
	}
	if (transientErrors.length > 0) {
		const failureLabel = transientErrors.length === 1 ? "failure" : "failures";

		throw new Error(
			`${transientErrors.length} story comparison generation ${failureLabel}: ${transientErrors[0]}`,
		);
	}
	return published;
}
