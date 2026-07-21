import type { HistoryElement } from "../../core/types.ts";
import { Badge } from "../../shared/Badge.tsx";
import { contentHistoryPath } from "./history-routes.ts";

export function HistoryContentItem({ element, site }: { element: HistoryElement; site: string }) {
	const copy = (
		<>
			<strong>{element.headline ?? `Untitled ${element.kind}`}</strong>
			{element.summary ? <p>{element.summary}</p> : null}
			<div className="history-story-tags">
				<Badge as="small">{element.category ?? element.section ?? "Front page"}</Badge>
				<Badge as="small">{element.position.viewportDepth.toFixed(1)} pages down</Badge>
			</div>
		</>
	);

	return (
		<li className={`history-content-item history-content-item--${element.kind}`}>
			<div className="history-story-rank">
				<span>{String(element.position.pageOrder).padStart(2, "0")}</span>
				<small>{element.prominence ?? "standard"}</small>
				<small className="history-content-kind">{element.kind}</small>
			</div>
			<a className="history-content-copy" href={contentHistoryPath(site, element.elementKey)}>
				{copy}
			</a>
		</li>
	);
}
