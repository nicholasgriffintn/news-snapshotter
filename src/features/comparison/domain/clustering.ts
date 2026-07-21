const MINIMUM_AUTOMATIC_SIMILARITY = 0.9;
const MAXIMUM_STORY_AGE_MS = 36 * 60 * 60 * 1_000;

function normalisedTerms(values: readonly string[]): Set<string> {
	return new Set(
		values.flatMap((value) => {
			return (
				value
					.toLocaleLowerCase("en-GB")
					.normalize("NFKC")
					.match(/[\p{L}\p{N}]{3,}/gu) ?? []
			);
		}),
	);
}

function normalisedEntities(values: readonly string[]): Set<string> {
	return new Set(
		values
			.map((value) =>
				value.toLocaleLowerCase("en-GB").normalize("NFKC").replace(/\s+/g, " ").trim(),
			)
			.filter(Boolean),
	);
}

function matchingTerms(
	label: string,
	candidateLabel: string,
	excludedTerms: ReadonlySet<string> = new Set(),
): { count: number; ratio: number } {
	const terms = normalisedTerms([label]);
	const candidateTerms = normalisedTerms([candidateLabel]);

	for (const term of excludedTerms) {
		terms.delete(term);
		candidateTerms.delete(term);
	}

	const count = [...terms].filter((term) => candidateTerms.has(term)).length;

	return {
		count,
		ratio: count / Math.max(terms.size, candidateTerms.size, 1),
	};
}

export function storyLabelSimilarity(label: string, candidateLabel: string): number {
	return matchingTerms(label, candidateLabel).ratio;
}

export function canJoinRecentStory(input: {
	candidateCapturedAt: string;
	candidateEntities: string[];
	candidateLabel: string;
	capturedAt: string;
	entities: string[];
	label: string;
}): boolean {
	const age = Math.abs(Date.parse(input.capturedAt) - Date.parse(input.candidateCapturedAt));
	if (!Number.isFinite(age) || age > MAXIMUM_STORY_AGE_MS) {
		return false;
	}

	const labelOverlap = matchingTerms(input.label, input.candidateLabel);
	const entityOverlap = matchingTerms(
		input.entities.join(" "),
		input.candidateEntities.join(" "),
	);

	if (entityOverlap.count > 0 && entityOverlap.ratio >= 0.5) {
		return labelOverlap.count >= 3 && labelOverlap.ratio >= 0.5;
	}

	return labelOverlap.count >= 4 && labelOverlap.ratio >= 0.75;
}

export function canJoinStory(input: {
	candidateCapturedAt: string;
	candidateEntities: string[];
	candidateLabel: string;
	capturedAt: string;
	entities: string[];
	label: string;
	similarity: number;
}): boolean {
	if (input.similarity < MINIMUM_AUTOMATIC_SIMILARITY) {
		return false;
	}
	const age = Math.abs(Date.parse(input.capturedAt) - Date.parse(input.candidateCapturedAt));
	if (!Number.isFinite(age) || age > MAXIMUM_STORY_AGE_MS) {
		return false;
	}
	const entities = normalisedEntities(input.entities);
	const candidateEntities = normalisedEntities(input.candidateEntities);
	const sharedEntities = [...entities].filter((entity) => candidateEntities.has(entity));

	if (sharedEntities.length > 0) {
		const entityTerms = normalisedTerms(sharedEntities);
		const overlap = matchingTerms(input.label, input.candidateLabel, entityTerms);

		return overlap.count >= 2 && overlap.ratio >= 0.25;
	}

	const overlap = matchingTerms(input.label, input.candidateLabel);
	return overlap.count >= 2 && overlap.ratio >= 0.5;
}

export function storySlug(label: string, storyId: string): string {
	const stem = label
		.toLocaleLowerCase("en-GB")
		.normalize("NFKD")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64);
	return `${stem || "story"}-${storyId.slice(0, 8)}`;
}
