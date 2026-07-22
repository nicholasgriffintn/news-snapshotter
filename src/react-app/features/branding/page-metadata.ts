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

	if (page === "compare") {
		const storyDetail = pathname.startsWith("/compare/stories/");
		return {
			canonicalPath: storyDetail ? pathname : "/compare",
			description:
				"Compare captured UK news homepages through evidence-linked story clusters, headline overlap and editorial prominence.",
			indexable: !storyDetail,
			title: storyDetail
				? "Story Comparison | News Snapshotter"
				: "Compare UK News Homepages | News Snapshotter",
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
	if (page === "not-found") {
		return {
			canonicalPath: pathname,
			description: "The requested News Snapshotter page was not found.",
			indexable: false,
			title: "Page not found | News Snapshotter",
		};
	}

	return {
		canonicalPath: "/",
		description: DEFAULT_DESCRIPTION,
		indexable: true,
		title: "News Snapshotter | Today’s News, Captured",
	};
}
