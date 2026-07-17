const STOP_WORDS = new Set([
	"about",
	"after",
	"again",
	"against",
	"been",
	"before",
	"being",
	"between",
	"could",
	"from",
	"for",
	"have",
	"into",
	"more",
	"most",
	"news",
	"over",
	"said",
	"than",
	"that",
	"the",
	"their",
	"them",
	"then",
	"there",
	"these",
	"they",
	"this",
	"those",
	"through",
	"under",
	"very",
	"what",
	"when",
	"where",
	"which",
	"while",
	"with",
	"would",
	"your",
]);

export function headlineWords(value: string): string[] {
	return (value.toLocaleLowerCase("en-GB").match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? [])
		.map((word) => word.replace("’", "'"))
		.filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

export function weightedWordFrequency(
	observations: Array<{ headline: string; weightSeconds: number }>,
): Array<{ count: number; label: string; weightSeconds: number }> {
	const words = new Map<string, { count: number; weightSeconds: number }>();
	for (const observation of observations) {
		for (const word of headlineWords(observation.headline)) {
			const current = words.get(word) ?? { count: 0, weightSeconds: 0 };
			current.count += 1;
			current.weightSeconds += observation.weightSeconds;
			words.set(word, current);
		}
	}

	return [...words]
		.map(([label, value]) => ({ label, ...value }))
		.sort((left, right) => {
			return (
				right.weightSeconds - left.weightSeconds ||
				right.count - left.count ||
				left.label.localeCompare(right.label)
			);
		});
}
