import { displayLabel } from "../../../core/text.ts";

const PRODUCT_LABELS: Array<[string, string]> = [
	["/commentisfree/", "Opinion"],
	["/opinion/", "Opinion"],
	["/comment/", "Opinion"],
	["/australia-news/", "Australia"],
	["/global-development/", "Global development"],
	["/us-news/", "US"],
	["/uk-news/", "UK"],
	["/dc-md-va/", "Local"],
	["/artanddesign/", "Art and design"],
	["/environment/", "Environment"],
	["/education/", "Education"],
	["/society/", "Society"],
	["/fashion/", "Fashion"],
	["/books/", "Books"],
	["/music/", "Music"],
	["/film/", "Film"],
	["/media/", "Media"],
	["/stage/", "Stage"],
	["/games/", "Games"],
	["/cities/", "Cities"],
	["/law/", "Law"],
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

function categoryLabel(value?: string): string | undefined {
	const label = value?.trim().replace(/\s+headlines?$/i, "");
	return label && label.length <= 80 ? displayLabel(label) : undefined;
}

export function contentCategory(
	canonicalUrl?: string,
	extracted?: string,
	section?: string,
): string {
	const extractedLabel = categoryLabel(extracted);
	if (extractedLabel) {
		return extractedLabel;
	}
	if (canonicalUrl) {
		try {
			const path = new URL(canonicalUrl).pathname.toLocaleLowerCase("en-GB");
			const inferred = PRODUCT_LABELS.find(([fragment]) => path.includes(fragment))?.[1];
			if (inferred) {
				return inferred;
			}
		} catch {
			// Fall through to the visible page section.
		}
	}

	return categoryLabel(section) ?? "Front page";
}
