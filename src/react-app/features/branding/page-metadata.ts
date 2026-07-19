import type { AppPage } from "../../core/app-route";
import { displayName } from "../../shared/format.ts";

export type PageMetadata = {
	canonicalPath: string;
	description: string;
	indexable: boolean;
	title: string;
};

const DEFAULT_DESCRIPTION =
	"Explore full-page snapshots of leading news and sport websites, preserved over time to track headlines, layouts and editorial change.";

export function resolvePageMetadata(
	page: AppPage,
	historySite: string,
	pathname: string,
): PageMetadata {
	if (page === "history") {
		if (!historySite) {
			return {
				canonicalPath: "/history",
				description:
					"Research how news websites, headlines and editorial priorities change across captured moments in time.",
				indexable: true,
				title: "News Website History and Editorial Change | News Snapshotter",
			};
		}

		const siteName = displayName(historySite);
		const canonicalPath = `/history/${encodeURIComponent(historySite)}`;
		const isSiteOverview = pathname === canonicalPath || pathname === `${canonicalPath}/`;
		return {
			canonicalPath,
			description: `Explore captured changes to ${siteName}, including headlines, story prominence and page layout over time.`,
			indexable: isSiteOverview,
			title: `${siteName} News Website History | News Snapshotter`,
		};
	}

	if (page === "privacy") {
		return {
			canonicalPath: "/privacy",
			description: "How News Snapshotter handles privacy and personal information.",
			indexable: false,
			title: "Privacy | News Snapshotter",
		};
	}

	if (page === "terms") {
		return {
			canonicalPath: "/terms",
			description: "Terms for using the News Snapshotter archive and research tools.",
			indexable: false,
			title: "Terms | News Snapshotter",
		};
	}

	if (page === "admin") {
		return {
			canonicalPath: "/admin",
			description: "News Snapshotter administration.",
			indexable: false,
			title: "Administration | News Snapshotter",
		};
	}

	return {
		canonicalPath: "/",
		description: DEFAULT_DESCRIPTION,
		indexable: true,
		title: "News Snapshotter | Today’s News, Captured",
	};
}
