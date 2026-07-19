import { useEffect, useState } from "react";

import { isAbortError } from "../../shared/errors.ts";
import type { ElementHistory } from "../../core/types.ts";
import { fetchElementHistory } from "../../platform/api-client.ts";
import { displayName } from "../../shared/format.ts";
import { ContentComparisonCard } from "./ContentComparisonCard.tsx";
import { HistoryNav } from "./HistoryNav.tsx";

export function ContentComparisonPage({
	elementKeys,
	preferredName,
	site,
}: {
	elementKeys: string[];
	preferredName?: string;
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

	const siteName = displayName(site, preferredName);

	return (
		<div className="history-page comparison-page">
			<header className="history-heading history-heading--comparison">
				<div>
					<p className="eyebrow">{siteName} research</p>
					<h1>Content trajectories</h1>
				</div>
				<div className="history-heading__intro">
					<p>
						See how selected content moved in prominence and position across the publisher page.
					</p>
					<a className="history-text-link" href={`/history/${encodeURIComponent(site)}/research`}>
						← Change selection
					</a>
				</div>
			</header>
			<HistoryNav current="research" site={site} />
			{elementKeys.length < 2 ? (
				<div className="empty-state">Select at least two items to compare.</div>
			) : null}
			{error ? <div className="empty-state empty-state--error">{error}</div> : null}
			{loading ? (
				<div aria-live="polite" className="empty-state" role="status">
					Loading comparison…
				</div>
			) : null}
			<div className="comparison-grid">
				{items.map((item) => (
					<ContentComparisonCard item={item} key={item.elementKey} site={site} />
				))}
			</div>
		</div>
	);
}
