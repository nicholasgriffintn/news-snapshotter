import { dateTimeLabel, displayName } from "../../shared/format.ts";
import type { HistorySiteListItem } from "./domain/history-site-filter.ts";

export function HistorySiteCard({ site }: { site: HistorySiteListItem }) {
	const historyPath = `/history/${encodeURIComponent(site.site)}`;

	return (
		<article className="history-site-card">
			<header>
				<span>{site.category ? displayName(site.category) : "Publisher"}</span>
				<time dateTime={site.lastCaptureAt}>Updated {dateTimeLabel(site.lastCaptureAt)}</time>
			</header>
			<h2>
				<a href={historyPath}>{site.displayName}</a>
			</h2>
			<dl>
				<div>
					<dt>Captures</dt>
					<dd>{site.captureCount.toLocaleString("en-GB")}</dd>
				</div>
				<div>
					<dt>Tracked items</dt>
					<dd>{site.contentCount.toLocaleString("en-GB")}</dd>
				</div>
			</dl>
			<nav aria-label={`${site.displayName} history views`}>
				<a href={historyPath}>View captures <span aria-hidden="true">→</span></a>
				<a href={`${historyPath}/research`}>Open research <span aria-hidden="true">→</span></a>
			</nav>
		</article>
	);
}
