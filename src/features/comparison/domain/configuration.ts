import type { SiteDefinition } from "../../../core/domain.ts";

export type ComparisonCohort = {
	displayName: string;
	id: string;
	jurisdiction: string;
	language: string;
	minimumAnalysedSites: number;
	windowMinutes: number;
};

export const COMPARISON_COHORTS: readonly ComparisonCohort[] = [
	{
		displayName: "UK national news",
		id: "uk-national-hourly",
		jurisdiction: "GB",
		language: "en",
		minimumAnalysedSites: 4,
		windowMinutes: 60,
	},
];

export function comparisonSites(
	sites: readonly SiteDefinition[],
	cohortId: string,
): SiteDefinition[] {
	return sites.filter((site) => {
		return site.comparison?.enabled === true && site.comparison.cohorts.includes(cohortId);
	});
}

export function assertComparisonConfiguration(
	sites: readonly SiteDefinition[],
	cohorts: readonly ComparisonCohort[],
): void {
	const cohortById = new Map<string, ComparisonCohort>();
	for (const cohort of cohorts) {
		if (cohortById.has(cohort.id)) {
			throw new Error(`Duplicate comparison cohort: ${cohort.id}`);
		}
		if (
			cohort.minimumAnalysedSites < 2 ||
			cohort.windowMinutes < 1 ||
			!cohort.language ||
			!cohort.jurisdiction
		) {
			throw new Error(`Invalid comparison cohort: ${cohort.id}`);
		}
		cohortById.set(cohort.id, cohort);
	}

	for (const site of sites) {
		const comparison = site.comparison;
		if (!comparison?.enabled) {
			continue;
		}
		if (site.category !== "news" || site.analysis?.device !== "desktop") {
			throw new Error(`Comparison site ${site.name} requires structured desktop extraction`);
		}
		if (
			comparison.maxHomepageItems < 1 ||
			comparison.maxHomepageItems > 100 ||
			new Set(comparison.cohorts).size !== comparison.cohorts.length
		) {
			throw new Error(`Invalid comparison configuration for ${site.name}`);
		}
		for (const cohortId of comparison.cohorts) {
			const cohort = cohortById.get(cohortId);
			if (!cohort) {
				throw new Error(`Site ${site.name} refers to unknown comparison cohort ${cohortId}`);
			}
			if (
				comparison.language !== cohort.language ||
				comparison.jurisdiction !== cohort.jurisdiction
			) {
				throw new Error(`Site ${site.name} does not match comparison cohort ${cohortId}`);
			}
		}
	}

	for (const cohort of cohorts) {
		if (comparisonSites(sites, cohort.id).length < cohort.minimumAnalysedSites) {
			throw new Error(`Comparison cohort ${cohort.id} has too few configured sites`);
		}
	}
}
