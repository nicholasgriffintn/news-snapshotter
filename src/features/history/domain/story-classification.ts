const PRODUCT_LABELS: Array<[string, string]> = [
	["/sport/", "Sport"],
	["/iplayer/", "iPlayer"],
	["/sounds/", "Sounds"],
	["/bitesize/", "Bitesize"],
	["/weather/", "Weather"],
	["/culture/", "Culture"],
	["/entertainment", "Culture"],
	["/business/", "Business"],
	["/politics/", "Politics"],
	["/world/", "World"],
	["/news/", "News"],
];

export function storyCategory(canonicalUrl?: string, extracted?: string): string {
	const label = extracted?.trim().replace(/\s+headlines?$/i, "");
	if (label && label.length <= 80) return label;
	if (!canonicalUrl) return "Front page";

	try {
		const path = new URL(canonicalUrl).pathname.toLocaleLowerCase("en-GB");
		return PRODUCT_LABELS.find(([fragment]) => path.includes(fragment))?.[1] ?? "Front page";
	} catch {
		return "Front page";
	}
}
