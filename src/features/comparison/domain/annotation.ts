import { pageElementPlacementKey, type PageExtraction } from "../../history/domain/extraction.ts";
import { hasOnlyKeys, jsonRecord } from "../../../core/json.ts";
import { isSafeAnalysisText } from "./pipeline.ts";

function stringArraySchema() {
	return {
		type: "array",
		maxItems: 20,
		items: { type: "string", minLength: 1, maxLength: 200 },
	};
}

export const COMPARISON_TOPICS = [
	"arts and culture",
	"business",
	"climate",
	"crime and justice",
	"economy",
	"education",
	"environment",
	"health",
	"international affairs",
	"media and entertainment",
	"monarchy",
	"politics",
	"science",
	"sport",
	"technology",
	"transport",
	"war and conflict",
] as const;

function topicArraySchema() {
	return {
		type: "array",
		maxItems: 5,
		uniqueItems: true,
		items: { type: "string", enum: [...COMPARISON_TOPICS] },
	};
}

const ANNOTATION_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: ["annotations"],
	properties: {
		annotations: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: false,
				required: [
					"confidence",
					"entities",
					"evidenceId",
					"framing",
					"locations",
					"normalisedLabel",
					"topics",
				],
				properties: {
					confidence: { type: "number", minimum: 0, maximum: 1 },
					entities: stringArraySchema(),
					evidenceId: { type: "string" },
					framing: {
						type: "object",
						additionalProperties: false,
						properties: {
							actors: stringArraySchema(),
							causalLanguage: stringArraySchema(),
							certainty: { type: "string", maxLength: 200 },
							emphasis: stringArraySchema(),
						},
					},
					locations: stringArraySchema(),
					normalisedLabel: { type: "string", minLength: 1, maxLength: 500 },
					topics: topicArraySchema(),
				},
			},
		},
	},
} as const;

export function captureAnnotationSchema(itemCount: number) {
	if (!Number.isInteger(itemCount) || itemCount < 1 || itemCount > 10) {
		throw new Error("Annotation schema item count must be between 1 and 10");
	}

	return {
		...ANNOTATION_SCHEMA,
		properties: {
			annotations: {
				...ANNOTATION_SCHEMA.properties.annotations,
				maxItems: itemCount,
				minItems: itemCount,
			},
		},
	};
}

const MAX_ARRAY_ITEMS = 20;
const MAX_VALUE_LENGTH = 200;

export type AnnotationEvidence = {
	category?: string;
	evidenceId: string;
	headline: string;
	kind: "audio" | "story" | "video";
	prominence?: "lead" | "major" | "minor" | "standard";
	rank: number;
	section?: string;
	summary?: string;
};

export type CaptureAnnotation = {
	annotations: Array<{
		confidence: number;
		entities: string[];
		evidenceId: string;
		framing: {
			actors?: string[];
			causalLanguage?: string[];
			certainty?: string;
			emphasis?: string[];
		};
		locations: string[];
		normalisedLabel: string;
		topics: string[];
	}>;
};

export type AnnotationEvidenceBinding = {
	elementKey: string;
	evidence: AnnotationEvidence;
	placementKey: string;
};

const LABEL_PREFIX =
	/^(?:audio|entertainment video|front page|news report|sport|sports video|video)\s*:\s*/i;
const GENERIC_LABELS = new Set([
	"audio",
	"business story",
	"entertainment",
	"entertainment video",
	"health story",
	"news story",
	"politics story",
	"sport story",
	"sports news",
	"sports video",
	"video",
	"world news story",
]);

type PageElement = PageExtraction["elements"][number];
type EditorialElement = PageElement & { kind: AnnotationEvidence["kind"] };

function isEditorialElement(element: PageElement): element is EditorialElement {
	return (
		(element.kind === "audio" || element.kind === "story" || element.kind === "video") &&
		Boolean(element.headline?.trim())
	);
}

function bounded(value: string | undefined, maximum: number): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed.slice(0, maximum) : undefined;
}

export function buildAnnotationEvidenceBindings(
	document: PageExtraction,
	maximumItems: number,
): AnnotationEvidenceBinding[] {
	return document.elements
		.filter(isEditorialElement)
		.sort((left, right) => left.position.pageOrder - right.position.pageOrder)
		.slice(0, Math.max(0, maximumItems))
		.map((element, index) => ({
			elementKey: element.elementKey,
			evidence: {
				category: bounded(element.category, 100),
				evidenceId: `e${index + 1}`,
				headline: bounded(element.headline, 500) ?? "",
				kind: element.kind,
				prominence: element.prominence,
				rank: element.position.pageOrder,
				section: bounded(element.section, 100),
				summary: bounded(element.summary, 1_000),
			},
			placementKey: pageElementPlacementKey(element),
		}));
}

export function buildAnnotationEvidence(
	document: PageExtraction,
	maximumItems: number,
): AnnotationEvidence[] {
	return buildAnnotationEvidenceBindings(document, maximumItems).map(({ evidence }) => evidence);
}

function specificEventLabel(label: string, headline: string): string {
	const cleaned = label.replace(LABEL_PREFIX, "").trim();
	const significantWords = cleaned.match(/[\p{L}\p{N}]{3,}/gu) ?? [];

	if (significantWords.length < 3 || GENERIC_LABELS.has(cleaned.toLocaleLowerCase("en-GB"))) {
		return headline;
	}

	return cleaned;
}

export function normaliseCaptureAnnotation(
	annotation: CaptureAnnotation,
	bindings: readonly AnnotationEvidenceBinding[],
): CaptureAnnotation {
	const evidenceById = new Map(bindings.map(({ evidence }) => [evidence.evidenceId, evidence]));

	return {
		annotations: annotation.annotations.map((item) => {
			const evidence = evidenceById.get(item.evidenceId);
			if (!evidence) {
				throw new Error(`Annotation evidence binding not found: ${item.evidenceId}`);
			}

			return {
				...item,
				normalisedLabel: specificEventLabel(item.normalisedLabel, evidence.headline),
			};
		}),
	};
}

export function captureEmbeddingTexts(
	annotation: CaptureAnnotation,
	bindings: readonly AnnotationEvidenceBinding[],
): string[] {
	const evidenceById = new Map(bindings.map(({ evidence }) => [evidence.evidenceId, evidence]));

	return annotation.annotations.map((item) => {
		const evidence = evidenceById.get(item.evidenceId);
		if (!evidence) {
			throw new Error(`Annotation evidence binding not found: ${item.evidenceId}`);
		}

		return [
			...new Set(
				[
					item.normalisedLabel,
					evidence.headline,
					evidence.summary,
					item.entities.join(", "),
				].filter((value): value is string => Boolean(value)),
			),
		].join("\n");
	});
}

function stringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) &&
		value.length <= MAX_ARRAY_ITEMS &&
		value.every((item) => isSafeAnalysisText(item, MAX_VALUE_LENGTH))
	);
}

function topicArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) &&
		value.length <= 5 &&
		new Set(value).size === value.length &&
		value.every(
			(item) =>
				typeof item === "string" &&
				COMPARISON_TOPICS.some((configuredTopic) => configuredTopic === item),
		)
	);
}

function parseFraming(
	value: unknown,
): CaptureAnnotation["annotations"][number]["framing"] | undefined {
	const framing = jsonRecord(value);
	if (
		!framing ||
		!hasOnlyKeys(framing, ["actors", "causalLanguage", "certainty", "emphasis"]) ||
		(framing.actors !== undefined && !stringArray(framing.actors)) ||
		(framing.causalLanguage !== undefined && !stringArray(framing.causalLanguage)) ||
		(framing.emphasis !== undefined && !stringArray(framing.emphasis)) ||
		(framing.certainty !== undefined && !isSafeAnalysisText(framing.certainty, MAX_VALUE_LENGTH))
	) {
		return undefined;
	}

	const parsed: CaptureAnnotation["annotations"][number]["framing"] = {};
	if (framing.actors !== undefined) {
		parsed.actors = framing.actors;
	}
	if (framing.causalLanguage !== undefined) {
		parsed.causalLanguage = framing.causalLanguage;
	}
	if (framing.certainty !== undefined) {
		parsed.certainty = framing.certainty;
	}
	if (framing.emphasis !== undefined) {
		parsed.emphasis = framing.emphasis;
	}

	return parsed;
}

export function parseCaptureAnnotation(
	value: unknown,
	evidenceIds: ReadonlySet<string>,
): CaptureAnnotation {
	const document = jsonRecord(value);
	if (
		!document ||
		!hasOnlyKeys(document, ["annotations"]) ||
		!Array.isArray(document.annotations)
	) {
		throw new Error("Model returned an invalid capture annotation");
	}
	const seen = new Set<string>();
	const annotations: CaptureAnnotation["annotations"] = [];
	for (const item of document.annotations) {
		const annotation = jsonRecord(item);
		if (!annotation) {
			throw new Error("Model returned an invalid capture annotation");
		}
		if (
			!hasOnlyKeys(annotation, [
				"confidence",
				"entities",
				"evidenceId",
				"framing",
				"locations",
				"normalisedLabel",
				"topics",
			]) ||
			typeof annotation.evidenceId !== "string" ||
			!evidenceIds.has(annotation.evidenceId) ||
			seen.has(annotation.evidenceId)
		) {
			throw new Error("Capture annotation references unknown evidence");
		}
		const framing = parseFraming(annotation.framing);
		if (
			typeof annotation.confidence !== "number" ||
			!Number.isFinite(annotation.confidence) ||
			annotation.confidence < 0 ||
			annotation.confidence > 1 ||
			!stringArray(annotation.entities) ||
			!framing ||
			!stringArray(annotation.locations) ||
			!isSafeAnalysisText(annotation.normalisedLabel, 500) ||
			!topicArray(annotation.topics)
		) {
			throw new Error("Model returned an invalid capture annotation");
		}
		seen.add(annotation.evidenceId);
		annotations.push({
			confidence: annotation.confidence,
			entities: annotation.entities,
			evidenceId: annotation.evidenceId,
			framing,
			locations: annotation.locations,
			normalisedLabel: annotation.normalisedLabel,
			topics: annotation.topics,
		});
	}
	if (seen.size !== evidenceIds.size) {
		throw new Error("Model omitted capture annotation evidence");
	}
	return { annotations };
}
