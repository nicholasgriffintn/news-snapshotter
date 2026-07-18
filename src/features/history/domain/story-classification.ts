import { displayLabel } from "../../../core/text.ts";

const PRODUCT_LABELS: Array<[string, string]> = [
	["/commentisfree/", "Opinion"],
	["/opinion/", "Opinion"],
	["/comment/", "Opinion"],
	["/dc-md-va/", "Local"],
	["/lifeandstyle/", "Lifestyle"],
	["/life-style/", "Lifestyle"],
	["/tvshowbiz/", "Showbiz"],
	["/technology/", "Technology"],
	["/sport/", "Sport"],
	["/football/", "Football"],
	["/iplayer/", "iPlayer"],
	["/sounds/", "Sounds"],
	["/bitesize/", "Bitesize"],
	["/weather/", "Weather"],
	["/culture/", "Culture"],
	["/entertainment", "Culture"],
	["/lifestyle/", "Lifestyle"],
	["/science/", "Science"],
	["/health/", "Health"],
	["/climate/", "Climate"],
	["/travel/", "Travel"],
	["/money/", "Money"],
	["/style/", "Style"],
	["/food/", "Food"],
	["/royals/", "Royals"],
	["/cricket/", "Cricket"],
	["/golf/", "Golf"],
	["/tech/", "Technology"],
	["/business/", "Business"],
	["/politics/", "Politics"],
	["/world/", "World"],
	["/national/", "US"],
	["/uk/", "UK"],
	["/us/", "US"],
	["/news/", "News"],
];

export function storyCategory(canonicalUrl?: string, extracted?: string): string {
	const label = extracted?.trim().replace(/\s+headlines?$/i, "");
	if (label && label.length <= 80) {
		return displayLabel(label);
	}
	if (!canonicalUrl) {
		return "Front page";
	}

	try {
		const path = new URL(canonicalUrl).pathname.toLocaleLowerCase("en-GB");
		return PRODUCT_LABELS.find(([fragment]) => path.includes(fragment))?.[1] ?? "Front page";
	} catch {
		return "Front page";
	}
}
