import { useEffect } from "react";

import type { AppPage } from "../../core/app-route";
import { resolvePageMetadata } from "./page-metadata";

const SITE_ORIGIN = "https://news-snapshotter.pashi.app";

type PageMetadataProps = {
	historySite: string;
	page: AppPage;
};

export function PageMetadata({ historySite, page }: PageMetadataProps) {
	useEffect(() => {
		const metadata = resolvePageMetadata(page, historySite, window.location.pathname);
		const canonicalUrl = new URL(metadata.canonicalPath, SITE_ORIGIN).href;

		document.title = metadata.title;
		document
			.querySelector<HTMLMetaElement>("#page-description")
			?.setAttribute("content", metadata.description);
		document
			.querySelector<HTMLMetaElement>("#page-robots")
			?.setAttribute(
				"content",
				metadata.indexable ? "index, follow, max-image-preview:large" : "noindex, follow",
			);
		document
			.querySelector<HTMLMetaElement>("#open-graph-title")
			?.setAttribute("content", metadata.title);
		document
			.querySelector<HTMLMetaElement>("#open-graph-description")
			?.setAttribute("content", metadata.description);
		document
			.querySelector<HTMLMetaElement>("#open-graph-url")
			?.setAttribute("content", canonicalUrl);
		document
			.querySelector<HTMLMetaElement>("#twitter-title")
			?.setAttribute("content", metadata.title);
		document
			.querySelector<HTMLMetaElement>("#twitter-description")
			?.setAttribute("content", metadata.description);

		let canonical = document.querySelector<HTMLLinkElement>("#page-canonical");
		if (!canonical) {
			canonical = document.createElement("link");
			canonical.id = "page-canonical";
			canonical.rel = "canonical";
			document.head.append(canonical);
		}
		canonical.href = canonicalUrl;
	}, [historySite, page]);

	return null;
}
