import type { ElementHistory } from "../../core/types.ts";
import { ButtonLink } from "../../shared/Button.tsx";
import { Card } from "../../shared/Card.tsx";
import { displayName } from "../../shared/format.ts";
import { SectionHeader } from "../../shared/PageHeaders.tsx";
import { ContentTimelineChart } from "./ContentTimelineChart.tsx";
import { contentHistoryPath } from "./history-routes.ts";

export function ContentComparisonCard({ item, site }: { item: ElementHistory; site: string }) {
	const latest = item.observations.at(-1);
	const title = latest?.headline ?? item.elementKey;

	return (
		<Card className="research-panel comparison-card">
			<SectionHeader
				aside={
					<div className="research-result__meta">
						<span>{displayName(item.kind)}</span>
						<span>{item.observations.length} observations</span>
					</div>
				}
				title={title}
			/>
			<ContentTimelineChart observations={item.observations} />
			<ButtonLink
				className="comparison-card__action"
				href={contentHistoryPath(site, item.elementKey)}
				variant="secondary"
			>
				Full content history →
			</ButtonLink>
		</Card>
	);
}
