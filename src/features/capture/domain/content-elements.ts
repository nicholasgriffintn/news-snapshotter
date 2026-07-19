import type { PageElementKind } from "../../../core/contracts.ts";
import { safeSegment } from "../../../core/storage-key.ts";
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
): Array<CollectedElement & { placementKey: string }> {
	const visibleElements = elements
		.filter((element) => {
			return element.position.height > 0 && element.position.width > 0;
		})
		.sort((left, right) => {
			return (
				left.position.top - right.position.top ||
				left.position.left - right.position.left ||
				left.elementKey.localeCompare(right.elementKey)
			);
		});
	const uniquePlacements = new Map<string, CollectedElement>();

	for (const element of visibleElements) {
		const position = element.position;
		const physicalPlacementKey = [
			element.elementKey,
			position.top,
			position.left,
			position.width,
			position.height,
		].join("\n");
		if (!uniquePlacements.has(physicalPlacementKey)) {
			uniquePlacements.set(physicalPlacementKey, element);
		}
	}

	const occurrences = new Map<string, number>();

	return [...uniquePlacements.values()].map((element, index) => {
			const context = safeSegment(element.section ?? element.category ?? element.kind) || "page";
			const placementGroup = `${element.elementKey}\n${context}`;
			const occurrence = (occurrences.get(placementGroup) ?? 0) + 1;
			occurrences.set(placementGroup, occurrence);
			let summary = element.summary;

			if (summary === element.headline) {
				summary = undefined;
			}

			return {
				...element,
				placementKey: `${element.elementKey}#section=${context}&occurrence=${occurrence}`,
				position: {
					...element.position,
					pageOrder: index + 1,
				},
				summary,
			};
	});
}
