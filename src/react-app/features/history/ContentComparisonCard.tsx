import type { ElementHistory } from "../../core/types.ts";
import { displayName } from "../../shared/format.ts";
import { ContentTimelineChart } from "./ContentTimelineChart.tsx";
import { contentHistoryPath } from "./history-routes.ts";

export function ContentComparisonCard({ item, site }: { item: ElementHistory; site: string }) {
	const latest = item.observations.at(-1);
	const title = latest?.headline ?? item.elementKey;

	return (
		<article className="research-panel comparison-card">
			<header>
				<div>
					<p className="research-panel__kicker">Content trajectory</p>
					<h2>{title}</h2>
					<div className="research-result__meta">
						<span>{displayName(item.kind)}</span>
						<span>{item.observations.length} observations</span>
					</div>
				</div>
			</header>
			<ContentTimelineChart observations={item.observations} />
			<a
				className="research-panel__action comparison-card__action"
				href={contentHistoryPath(site, item.elementKey)}
			>
				Full content history →
			</a>
		</article>
	);
}
