import type { HistoryChange } from "../../../core/types.ts";

export type ChangeGroup = "appeared" | "content" | "disappeared" | "position" | "prominence";

const GROUP_BY_TYPE: Record<string, ChangeGroup> = {
	appeared: "appeared",
	"category-changed": "content",
	"headline-changed": "content",
	"image-alt-changed": "content",
	"image-changed": "content",
	"section-changed": "content",
	"summary-changed": "content",
	disappeared: "disappeared",
	"capture-gap": "position",
	"extractor-version-boundary": "position",
	"page-structure-changed": "position",
	"position-changed": "position",
	"rank-changed": "position",
	"size-changed": "position",
	demoted: "prominence",
	promoted: "prominence",
};

export function groupHistoryChanges(changes: HistoryChange[]): Map<ChangeGroup, HistoryChange[]> {
	return Map.groupBy(changes, ({ type }) => GROUP_BY_TYPE[type] ?? "content");
}

export function changeLabel(type: string): string {
	return type.replaceAll("-", " ");
}

export function changeValue(value: unknown): string {
	if (value === null || value === undefined || value === "") {
		return "None";
	}
	if (typeof value === "string" || typeof value === "number") {
		return String(value);
	}
	return JSON.stringify(value);
}
