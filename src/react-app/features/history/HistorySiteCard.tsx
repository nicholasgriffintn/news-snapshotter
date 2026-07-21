import { dateTimeLabel } from "../../shared/format.ts";
import { ButtonLink } from "../../shared/Button.tsx";
import { Card } from "../../shared/Card.tsx";
import type { HistorySiteListItem } from "./domain/history-site-filter.ts";

export function HistorySiteCard({ site }: { site: HistorySiteListItem }) {
	const historyPath = `/history/${encodeURIComponent(site.site)}`;

	return (
		<Card className="history-site-card">
			<div className="ui-card-meta__copy">
				<h2 className="ui-card-title">
					<a href={historyPath}>{site.displayName}</a>
				</h2>
				<span className="ui-card-description--meta">
					<time dateTime={site.lastCaptureAt}>Updated {dateTimeLabel(site.lastCaptureAt)}</time>
				</span>
			</div>
			<dl className="ui-card-stats">
				<div>
					<dt>Captures</dt>
					<dd>{site.captureCount.toLocaleString("en-GB")}</dd>
				</div>
				<div>
					<dt>Tracked items</dt>
					<dd>{site.contentCount.toLocaleString("en-GB")}</dd>
				</div>
			</dl>
			<nav
				aria-label={`${site.displayName} history views`}
				className="ui-card-actions ui-card-actions--split"
			>
				<ButtonLink href={historyPath} layout="card" variant="secondary">
					View captures <span aria-hidden="true">→</span>
				</ButtonLink>
				<ButtonLink href={`${historyPath}/research`} layout="card">
					Open research <span aria-hidden="true">→</span>
				</ButtonLink>
			</nav>
		</Card>
	);
}
