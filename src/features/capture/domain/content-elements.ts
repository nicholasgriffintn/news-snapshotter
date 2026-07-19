import type { PageElementKind } from "../../../core/contracts.ts";
import type { ElementPosition, PageElement } from "../../history/domain/extraction.ts";

export type CollectedElement = PageElement & {
	headline: string;
	kind: PageElementKind;
	position: ElementPosition;
	prominenceHint?: "lead";
	selectorHint: string;
};

export type CollectedPage = {
	elements: CollectedElement[];
	html: string;
	pageHeight: number;
	pageWidth: number;
	warnings: Array<{ code: string; message: string }>;
};

export function normaliseContentElements(
	elements: CollectedPage["elements"],
): CollectedPage["elements"] {
	const visibleElements = elements.filter((element) => {
		return element.position.height > 0 && element.position.width > 0;
	});
	const uniqueElements = new Map<string, CollectedElement>();

	for (const element of visibleElements) {
		if (!uniqueElements.has(element.elementKey)) {
			uniqueElements.set(element.elementKey, element);
		}
	}

	return [...uniqueElements.values()]
		.sort((left, right) => {
			return (
				left.position.top - right.position.top ||
				left.position.left - right.position.left ||
				left.elementKey.localeCompare(right.elementKey)
			);
		})
		.map((element, index) => {
			let summary = element.summary;

			if (summary === element.headline) {
				summary = undefined;
			}

			return {
				...element,
				position: {
					...element.position,
					pageOrder: index + 1,
				},
				summary,
			};
		});
}
