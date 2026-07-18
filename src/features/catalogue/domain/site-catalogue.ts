import type { CapturePriority, SiteDefinition, SiteSource } from "../../../core/domain.ts";

export type SiteSelection = {
	brand?: string;
	name?: string;
	priority?: CapturePriority;
};

type PriorityGroup = "local" | "standard";

function routePriority(site: SiteSource): CapturePriority {
	if (site.priority) {
		return site.priority;
	}

	const url = new URL(site.url);
	const segments = url.pathname.split("/").filter(Boolean);
	const isRoot = segments.length === 0;
	const isHomeIndex =
		segments.length === 2 && segments[0] === "home" && segments[1] === "index.html";

	if (isRoot || isHomeIndex) {
		return 1;
	}

	const isTopic = segments.includes("topics");
	const isMajorPublisherSection = ["news", "sport"].includes(segments[0]) && segments.length <= 2;

	if (!isTopic && (segments.length === 1 || isMajorPublisherSection)) {
		return 2;
	}

	return 3;
}

function resolvePriority(site: SiteSource, group: PriorityGroup): CapturePriority {
	if (site.priority) {
		return site.priority;
	}

	if (group === "local") {
		return 4;
	}

	return routePriority(site);
}

export function withBrand(
	brand: string,
	sites: SiteSource[],
	priorityGroup: PriorityGroup = "standard",
): SiteDefinition[] {
	return sites.map((site) => {
		return {
			...site,
			brand,
			captureRegion: site.captureRegion ?? "uk",
			priority: resolvePriority(site, priorityGroup),
		};
	});
}

export function withIndividualBrands(
	sites: SiteSource[],
	priorityGroup: PriorityGroup = "standard",
): SiteDefinition[] {
	return sites.map((site) => {
		return {
			...site,
			brand: site.name,
			captureRegion: site.captureRegion ?? "uk",
			priority: resolvePriority(site, priorityGroup),
		};
	});
}

export function withoutDuplicateNames(
	sites: SiteSource[],
	existingSites: SiteSource[],
): SiteSource[] {
	const existingNames = new Set(existingSites.map((site) => site.name));

	return sites.filter((site) => !existingNames.has(site.name));
}

export function selectSites(sites: SiteDefinition[], selection: SiteSelection): SiteDefinition[] {
	const selectors = [selection.brand, selection.name, selection.priority].filter((value) => {
		return value !== undefined;
	});

	if (selectors.length > 1) {
		throw new Error("Specify only one of brand, name, or priority");
	}

	if (selection.name) {
		const site = sites.find((candidate) => candidate.name === selection.name);
		if (!site) {
			throw new Error(`Unknown site name: ${selection.name}`);
		}
		return [site];
	}

	if (selection.brand) {
		const matchingSites = sites.filter((site) => {
			return site.brand === selection.brand;
		});
		if (matchingSites.length === 0) {
			throw new Error(`Unknown brand: ${selection.brand}`);
		}
		return matchingSites;
	}

	const priority = selection.priority ?? 1;

	return sites.filter((site) => {
		return site.priority === priority;
	});
}
