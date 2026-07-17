import type { SiteDefinition, SiteSource } from "../types";

export type SiteSelection = {
	brand?: string;
	name?: string;
};

export function withBrand(brand: string, sites: SiteSource[]): SiteDefinition[] {
	return sites.map((site) => ({ ...site, brand }));
}

export function withIndividualBrands(sites: SiteSource[]): SiteDefinition[] {
	return sites.map((site) => ({ ...site, brand: site.name }));
}

export function withoutDuplicateNames(
	sites: SiteSource[],
	existingSites: SiteSource[],
): SiteSource[] {
	const existingNames = new Set(existingSites.map((site) => site.name));
	return sites.filter((site) => !existingNames.has(site.name));
}

export function selectSites(sites: SiteDefinition[], selection: SiteSelection): SiteDefinition[] {
	if (selection.brand && selection.name) {
		throw new Error("Specify either brand or name, not both");
	}

	if (selection.name) {
		const site = sites.find((candidate) => candidate.name === selection.name);
		if (!site) {
			throw new Error(`Unknown site name: ${selection.name}`);
		}
		return [site];
	}

	if (selection.brand) {
		const matchingSites = sites.filter((site) => site.brand === selection.brand);
		if (matchingSites.length === 0) {
			throw new Error(`Unknown brand: ${selection.brand}`);
		}
		return matchingSites;
	}

	return sites;
}
