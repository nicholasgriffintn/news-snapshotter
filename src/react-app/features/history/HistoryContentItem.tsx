import type { HistoryElement } from "../../core/types.ts";
import { storyHistoryPath } from "./history-routes.ts";

function storyId(site: string, element: HistoryElement): string {
	return `${site}:${element.canonicalUrl ?? element.elementKey}`;
}

export function HistoryContentItem({ element, site }: { element: HistoryElement; site: string }) {
	const label = element.kind === "story" ? (element.prominence ?? "standard") : element.kind;
	const copy = (
		<>
			<strong>{element.headline ?? `Untitled ${element.kind}`}</strong>
			{element.summary ? <p>{element.summary}</p> : null}
			<div className="history-story-tags">
				<small>{element.section ?? element.category ?? "Front page"}</small>
				<small>{element.position.viewportDepth.toFixed(1)} pages down</small>
			</div>
		</>
	);

	return (
		<li className={`history-content-item history-content-item--${element.kind}`}>
			<div className="history-story-rank">
				<span>{String(element.position.pageOrder).padStart(2, "0")}</span>
				<small>{label}</small>
			</div>
			{element.kind === "story" ? (
				<a className="history-content-copy" href={storyHistoryPath(site, storyId(site, element))}>
					{copy}
				</a>
			) : element.canonicalUrl ? (
				<a
					className="history-content-copy"
					href={element.canonicalUrl}
					rel="noreferrer"
					target="_blank"
				>
					{copy}
				</a>
			) : (
				<div className="history-content-copy">{copy}</div>
			)}
		</li>
	);
}
