import { InvalidInputError } from "../../../core/errors.ts";
import { safeSegment } from "../../../core/storage-key.ts";
import type { SiteDefinition } from "../../../core/domain.ts";

const MAX_SCREENSHOT_DATES = 4;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function utcDateValue(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function isValidDateValue(value: string): boolean {
	if (!DATE_PATTERN.test(value)) {
		return false;
	}
	return utcDateValue(new Date(`${value}T00:00:00.000Z`)) === value;
}

export function parseScreenshotDates(values: string[], now = new Date()): string[] {
	if (values.length > MAX_SCREENSHOT_DATES) {
		throw new InvalidInputError(`Provide at most ${MAX_SCREENSHOT_DATES} date parameters`);
	}
	if (values.some((value) => !isValidDateValue(value))) {
		throw new InvalidInputError("date parameters must be valid dates");
	}
	if (values.length > 0) {
		return [...new Set(values)].sort();
	}

	const preceding = new Date(now);
	preceding.setUTCDate(preceding.getUTCDate() - 1);
	return [utcDateValue(preceding), utcDateValue(now)];
}

export function screenshotPrefixes(
	sites: ReadonlyArray<Pick<SiteDefinition, "brand" | "category">>,
	dates: readonly string[],
): string[] {
	const sitePrefixes = new Set(
		sites.map(({ brand, category }) => `brand=${safeSegment(brand)}/category=${category}`),
	);

	return [...sitePrefixes].flatMap((prefix) => {
		return dates.map((date) => `${prefix}/date=${date}/`);
	});
}
