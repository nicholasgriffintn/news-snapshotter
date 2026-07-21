import { hasOnlyKeys, jsonRecord } from "../../../core/json.ts";
import { COMPARISON_PIPELINE, isSafeAnalysisText, mentionsPublisher } from "./pipeline.ts";

const evidenceIds = {
	type: "array",
	minItems: 2,
	maxItems: 20,
	uniqueItems: true,
	items: { type: "string", minLength: 1, maxLength: 100 },
} as const;

const finding = {
	type: "object",
	additionalProperties: false,
	required: ["evidenceIds", "statement"],
	properties: {
		evidenceIds,
		statement: { type: "string", minLength: 1, maxLength: 500 },
	},
} as const;

export const STORY_COMPARISON_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: ["commonGround", "confidence", "differences", "summary"],
	properties: {
		commonGround: {
			type: "array",
			maxItems: 8,
			items: finding,
		},
		confidence: { type: "number", minimum: 0, maximum: 1 },
		differences: {
			type: "array",
			maxItems: 8,
			items: finding,
		},
		summary: { type: "string", minLength: 1, maxLength: 800 },
	},
} as const;

export type StoryComparisonEvidence = {
	category?: string;
	entities: string[];
	evidenceId: string;
	framing: Record<string, unknown>;
	headline: string;
	prominence?: "lead" | "major" | "minor" | "standard";
	rank: number;
	section?: string;
	summary?: string;
	topics: string[];
};

export type StoryComparisonFinding = {
	evidenceIds: string[];
	statement: string;
};

export type StoryComparison = {
	commonGround: StoryComparisonFinding[];
	confidence: number;
	differences: StoryComparisonFinding[];
	summary: string;
};

function mentionsEvidenceId(value: string, evidenceSites: ReadonlyMap<string, string>): boolean {
	const tokens = new Set(
		value
			.toLocaleLowerCase("en-GB")
			.split(/[^\p{L}\p{N}_-]+/u)
			.filter(Boolean),
	);

	return [...evidenceSites.keys()].some((evidenceId) =>
		tokens.has(evidenceId.toLocaleLowerCase("en-GB")),
	);
}

function parseFindings(
	value: unknown,
	evidenceSites: ReadonlyMap<string, string>,
	publisherNames: readonly string[],
): StoryComparisonFinding[] | undefined {
	if (!Array.isArray(value) || value.length > 8) {
		return undefined;
	}
	const findings: StoryComparisonFinding[] = [];
	for (const valueItem of value) {
		const item = jsonRecord(valueItem);
		if (
			!item ||
			!hasOnlyKeys(item, ["evidenceIds", "statement"]) ||
			!isSafeAnalysisText(item.statement, 500) ||
			mentionsPublisher(item.statement, publisherNames) ||
			mentionsEvidenceId(item.statement, evidenceSites) ||
			!Array.isArray(item.evidenceIds) ||
			item.evidenceIds.length < 2 ||
			item.evidenceIds.length > 20 ||
			!item.evidenceIds.every((evidenceId) => typeof evidenceId === "string")
		) {
			return undefined;
		}
		const evidenceIds = [...new Set(item.evidenceIds)];
		if (
			evidenceIds.length !== item.evidenceIds.length ||
			evidenceIds.some((evidenceId) => !evidenceSites.has(evidenceId)) ||
			new Set(evidenceIds.map((evidenceId) => evidenceSites.get(evidenceId))).size < 2
		) {
			return undefined;
		}
		findings.push({ evidenceIds, statement: item.statement.trim() });
	}
	return findings;
}

export function parseStoryComparison(
	value: unknown,
	evidenceSites: ReadonlyMap<string, string>,
	publisherNames: readonly string[] = [],
): StoryComparison {
	const document = jsonRecord(value);
	if (
		!document ||
		!hasOnlyKeys(document, ["commonGround", "confidence", "differences", "summary"])
	) {
		throw new Error("Model returned an invalid story comparison");
	}
	const commonGround = parseFindings(document.commonGround, evidenceSites, publisherNames);
	const differences = parseFindings(document.differences, evidenceSites, publisherNames);
	if (
		!commonGround ||
		!differences ||
		!isSafeAnalysisText(document.summary, 800) ||
		mentionsPublisher(document.summary, publisherNames) ||
		mentionsEvidenceId(document.summary, evidenceSites) ||
		typeof document.confidence !== "number" ||
		!Number.isFinite(document.confidence) ||
		document.confidence < COMPARISON_PIPELINE.minimumComparisonConfidence ||
		document.confidence > 1
	) {
		throw new Error("Model returned an invalid story comparison");
	}
	return {
		commonGround,
		confidence: document.confidence,
		differences,
		summary: document.summary.trim(),
	};
}
