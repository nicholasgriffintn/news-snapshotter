import type { PageElement } from "../../history/domain/extraction.ts";

type Prominence = NonNullable<PageElement["prominence"]>;

const MAJOR_WIDTH_RATIO = 1 / 3;
const LEAD_WIDTH_RATIO = 1 / 4;
const MINOR_WIDTH_RATIO = 1 / 6;

export function determineStoryProminence<T extends PageElement>(
	stories: T[],
	pageWidth: number,
): Array<T & { prominence: Prominence }> {
	const width = pageWidth > 0 ? pageWidth : Number.POSITIVE_INFINITY;

	const classified = stories.map((story) => {
		const widthRatio = story.position.width / width;
		let prominence: Prominence = "standard";

		if (widthRatio >= MAJOR_WIDTH_RATIO) {
			prominence = "major";
		} else if (widthRatio < MINOR_WIDTH_RATIO) {
			prominence = "minor";
		}

		return { ...story, prominence };
	});

	const lead = classified
		.filter((story) => {
			return (
				story.position.viewportDepth <= 1 &&
				(story.selectorHint === "h1" || story.position.width / width >= LEAD_WIDTH_RATIO)
			);
		})
		.sort((left, right) => {
			const headingDifference =
				Number(right.selectorHint === "h1") - Number(left.selectorHint === "h1");
			if (headingDifference !== 0) {
				return headingDifference;
			}
			const widthDifference = right.position.width - left.position.width;
			if (widthDifference !== 0) {
				return widthDifference;
			}
			return left.position.top - right.position.top;
		})[0];

	return classified.map((story) => {
		return story.elementKey === lead?.elementKey ? { ...story, prominence: "lead" } : story;
	});
}
