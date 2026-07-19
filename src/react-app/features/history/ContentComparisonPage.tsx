import { useEffect, useState } from "react";

import { isAbortError } from "../../shared/errors.ts";
import type { ElementHistory } from "../../core/types.ts";
import { fetchElementHistory } from "../../platform/api-client.ts";
import { ContentTimelineChart } from "./ContentTimelineChart.tsx";
import { HistoryNav } from "./HistoryNav.tsx";
import { contentHistoryPath } from "./history-routes.ts";

export function ContentComparisonPage({
	elementKeys,
	site,
}: {
	elementKeys: string[];
	site: string;
}) {
	const [items, setItems] = useState<ElementHistory[]>([]);
	const [error, setError] = useState<string>();
	const [loading, setLoading] = useState(false);
	const elementKeySignature = elementKeys.slice(0, 10).join("\n");

	useEffect(() => {
		const controller = new AbortController();
		setError(undefined);
		setItems([]);
		if (elementKeys.length < 2) {
			setLoading(false);
			return () => controller.abort();
		}
		setLoading(true);
		Promise.all(
			elementKeys
				.slice(0, 10)
				.map((key) => fetchElementHistory(site, key, { signal: controller.signal })),
		)
			.then((nextItems) => {
				if (!controller.signal.aborted) {
					setItems(nextItems);
				}
			})
			.catch((reason: unknown) => {
				if (!isAbortError(reason)) {
					setError(reason instanceof Error ? reason.message : "Could not compare content");
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setLoading(false);
				}
			});
		return () => controller.abort();
	}, [site, elementKeySignature]);

	return (
		<div className="history-page comparison-page">
			<header className="history-heading">
				<div>
					<h1>Content trajectories</h1>
				</div>
			</header>
			<HistoryNav current="research" site={site} />
			{elementKeys.length < 2 ? (
				<div className="empty-state">Select at least two items to compare.</div>
			) : null}
			{error ? <div className="empty-state empty-state--error">{error}</div> : null}
			{loading ? <div className="empty-state">Loading comparison…</div> : null}
			<div className="comparison-grid">
				{items.map((item) => {
					const latest = item.observations.at(-1);
					return (
						<article key={item.elementKey}>
							<p className="eyebrow">
								{item.kind} · {item.observations.length} observations
							</p>
							<h2>{latest?.headline ?? item.elementKey}</h2>
							<ContentTimelineChart observations={item.observations} />
							<a href={contentHistoryPath(site, item.elementKey)}>Full content history →</a>
						</article>
					);
				})}
			</div>
		</div>
	);
}
