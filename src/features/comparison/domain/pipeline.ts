import { errorMessage } from "../../../core/errors.ts";
import { sha256 } from "../../../core/hash.ts";
import type { ComparisonCohort } from "./configuration.ts";

export type AnalysisMessage =
	| {
			captureId: string;
			contentHash: string;
			finaliseAfterAnalysis?: boolean;
			kind: "analyse-capture";
	  }
	| {
			cohortId: string;
			deadlineAt: string;
			kind: "finalise-window";
			windowId: string;
	  };

export class TerminalAnalysisError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TerminalAnalysisError";
	}
}

export class TransientAnalysisError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TransientAnalysisError";
	}
}

export const ANALYSIS_STALE_AFTER_MS = 4 * 60_000;

const UNSAFE_ANALYSIS_TEXT = [
	/[\u0000-\u001f\u007f]/u,
	/<\/?[a-z][^>]*>/iu,
	/(?:https?:\/\/|www\.)/iu,
	/(?:[a-z0-9-]+\.)+(?:co\.uk|com|net|org)\b/iu,
];

export function isSafeAnalysisText(value: unknown, maximumLength: number): value is string {
	if (typeof value !== "string" || value.length === 0 || value.length > maximumLength) {
		return false;
	}

	const normalised = value.normalize("NFKC");
	return UNSAFE_ANALYSIS_TEXT.every((pattern) => !pattern.test(normalised));
}

export function mentionsPublisher(value: string, publisherNames: readonly string[]): boolean {
	const normalisedValue = value
		.toLocaleLowerCase("en-GB")
		.normalize("NFKC")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();

	return publisherNames.some((publisherName) => {
		const normalisedName = publisherName
			.toLocaleLowerCase("en-GB")
			.normalize("NFKC")
			.replace(/[^\p{L}\p{N}]+/gu, " ")
			.trim();

		return normalisedName.length >= 3 && ` ${normalisedValue} `.includes(` ${normalisedName} `);
	});
}

export const COMPARISON_PIPELINE = {
	canaryEvaluationHours: 24,
	embeddingDimensions: 768,
	embeddingModel: "@cf/google/embeddinggemma-300m",
	embeddingVersion: 2,
	generationModel: "@cf/google/gemma-4-26b-a4b-it",
	generationWindowMinutes: 60,
	inferenceTimeoutMs: 90_000,
	maximumCanaryDegradedRate: 0.25,
	maximumCanaryRegression: 0.1,
	maxGenerationFailuresPerWindow: 10,
	maxStoryComparisonsPerWindow: 20,
	maxTokensPerGenerationWindow: 250_000,
	minimumComparisonConfidence: 0.75,
	minimumCanaryRuns: 5,
	pipelineVersion: 4,
	promptVersion: 6,
	schemaVersion: 1,
	taxonomyVersion: 2,
} as const;

export type GenerationVariant = {
	model: string;
	rollout: "canary" | "primary";
};

export function selectGenerationVariant(
	inputHash: string,
	configuration: { canaryModel?: string; canaryPercent?: string },
): GenerationVariant {
	const canaryModel = configuration.canaryModel?.trim();
	const rawPercent = configuration.canaryPercent?.trim() || "0";
	const canaryPercent = Number(rawPercent);
	if (
		!Number.isInteger(canaryPercent) ||
		canaryPercent < 0 ||
		canaryPercent > 100 ||
		(!canaryModel && canaryPercent > 0) ||
		(canaryModel && !/^@cf\/[a-z0-9._/-]+$/i.test(canaryModel))
	) {
		throw new TerminalAnalysisError("Comparison canary configuration is invalid");
	}
	if (!canaryModel || canaryModel === COMPARISON_PIPELINE.generationModel || canaryPercent === 0) {
		return { model: COMPARISON_PIPELINE.generationModel, rollout: "primary" };
	}
	if (!/^[a-f0-9]{64}$/.test(inputHash)) {
		throw new TerminalAnalysisError("Comparison input hash is invalid");
	}

	const bucket = Number.parseInt(inputHash.slice(0, 8), 16) / 0x1_0000_0000;
	return bucket < canaryPercent / 100
		? { model: canaryModel, rollout: "canary" }
		: { model: COMPARISON_PIPELINE.generationModel, rollout: "primary" };
}

type WindowStoryCandidate = {
	evidence: ReadonlyArray<{
		prominence?: "lead" | "major" | "minor" | "standard";
		rank: number;
	}>;
	storyId: string;
};

const PROMINENCE_WEIGHT = {
	lead: 4,
	major: 3,
	minor: 1,
	standard: 2,
} as const;

function storyProminence(story: WindowStoryCandidate): number {
	return Math.max(
		0,
		...story.evidence.map(({ prominence }) => (prominence ? PROMINENCE_WEIGHT[prominence] : 0)),
	);
}

function storyRank(story: WindowStoryCandidate): number {
	return Math.min(...story.evidence.map(({ rank }) => rank));
}

export function prioritiseWindowStories<T extends WindowStoryCandidate>(
	stories: readonly T[],
	limit: number,
): T[] {
	return [...stories]
		.sort((left, right) => {
			return (
				right.evidence.length - left.evidence.length ||
				storyProminence(right) - storyProminence(left) ||
				storyRank(left) - storyRank(right) ||
				left.storyId.localeCompare(right.storyId)
			);
		})
		.slice(0, Math.max(0, limit));
}

export async function analysisIdempotencyKey(
	inputHash: string,
	kind: string,
	model: string = COMPARISON_PIPELINE.generationModel,
): Promise<string> {
	return sha256(
		[
			inputHash,
			kind,
			COMPARISON_PIPELINE.pipelineVersion,
			COMPARISON_PIPELINE.taxonomyVersion,
			COMPARISON_PIPELINE.promptVersion,
			COMPARISON_PIPELINE.schemaVersion,
			model,
			COMPARISON_PIPELINE.embeddingVersion,
			COMPARISON_PIPELINE.embeddingModel,
		].join(":"),
	);
}

export function analysisRetryDelaySeconds(attempts: number): number {
	return Math.min(3_600, 60 * 2 ** Math.max(0, attempts - 1));
}

export function isRetryableAnalysisError(error: unknown): boolean {
	if (error instanceof TransientAnalysisError) {
		return true;
	}

	if (error instanceof TerminalAnalysisError) {
		return false;
	}

	if (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)) {
		return true;
	}

	const message = errorMessage(error).toLocaleLowerCase("en-GB");
	return (
		/\b(429|500|502|503|504)\b/.test(message) ||
		[
			"connection reset",
			"network connection lost",
			"database is locked",
			"fetch failed",
			"gateway time-out",
			"rate limit",
			"sqlite_busy",
			"temporarily unavailable",
			"timed out",
			"timeout",
			"too many requests",
		].some((fragment) => message.includes(fragment))
	);
}

export function windowPublicationStatus(input: {
	analysedSites: number;
	capturedSites: number;
	expectedSites: number;
	minimumSites: number;
}): "complete" | "partial" | "suppressed" {
	if (input.analysedSites < input.minimumSites) {
		return "suppressed";
	}

	if (input.capturedSites < input.expectedSites || input.analysedSites < input.capturedSites) {
		return "partial";
	}

	return "complete";
}

export function comparisonWindowPeriod(
	cohort: ComparisonCohort,
	timestamp: string,
): { endsAt: string; startsAt: string; windowId: string } {
	const capturedAt = Date.parse(timestamp);

	if (!Number.isFinite(capturedAt)) {
		throw new Error("Comparison window timestamp is invalid");
	}

	const duration = cohort.windowMinutes * 60_000;
	const startsAt = new Date(Math.floor(capturedAt / duration) * duration);
	const endsAt = new Date(startsAt.getTime() + duration);

	return {
		endsAt: endsAt.toISOString(),
		startsAt: startsAt.toISOString(),
		windowId: `${cohort.id}:${startsAt.toISOString()}`,
	};
}
