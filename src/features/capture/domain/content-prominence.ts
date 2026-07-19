import type { PageElement } from "../../history/domain/extraction.ts";

type Prominence = NonNullable<PageElement["prominence"]>;
type ProminenceCandidate = PageElement & { prominenceHint?: Prominence };

const MAJOR_WIDTH_RATIO = 1 / 3;
const LEAD_WIDTH_RATIO = 1 / 4;
const MINOR_WIDTH_RATIO = 1 / 6;

function visualImpact(element: PageElement): number {
	const area = element.position.width * element.position.height;
	return area / (1 + Math.max(element.position.viewportDepth, 0));
}

export function determineContentProminence<T extends ProminenceCandidate>(
	content: T[],
	pageWidth: number,
): Array<T & { prominence: Prominence }> {
	const width = pageWidth > 0 ? pageWidth : Number.POSITIVE_INFINITY;

	const classified = content.map((element) => {
		const widthRatio = element.position.width / width;
		let prominence: Prominence = "standard";

		if (widthRatio >= MAJOR_WIDTH_RATIO) {
			prominence = "major";
		} else if (widthRatio < MINOR_WIDTH_RATIO) {
			prominence = "minor";
		}

		return { ...element, prominence };
	});

	const explicitLead = classified
		.filter(({ position, prominenceHint }) => {
			return prominenceHint === "lead" && position.viewportDepth <= 1;
		})
		.sort((left, right) => {
			return (
				left.position.top - right.position.top ||
				left.position.left - right.position.left ||
				right.position.width - left.position.width
			);
		})[0];
	const inferredLead = classified
		.filter((element) => {
			return (
				element.position.viewportDepth <= 1 &&
				element.position.width / width >= LEAD_WIDTH_RATIO
			);
		})
		.sort((left, right) => {
			const impactDifference = visualImpact(right) - visualImpact(left);
			if (impactDifference !== 0) {
				return impactDifference;
			}
			return (
				left.position.top - right.position.top || left.position.left - right.position.left
			);
		})[0];
	const lead = explicitLead ?? inferredLead;

	return classified.map((element) => {
		return element.elementKey === lead?.elementKey ? { ...element, prominence: "lead" } : element;
	});
}
