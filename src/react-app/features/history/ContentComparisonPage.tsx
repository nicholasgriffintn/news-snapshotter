import { useEffect, useState } from "react";

import { isAbortError } from "../../shared/errors.ts";
import type { ElementHistory } from "../../core/types.ts";
import { ButtonLink } from "../../shared/Button.tsx";
import { fetchElementHistory } from "../../platform/api-client.ts";

import { NoDataState } from "../../shared/NoDataState.tsx";
import { PageHeader } from "../../shared/PageHeaders.tsx";
import { StatusMessage } from "../../shared/StatusMessage.tsx";
import { ContentComparisonCard } from "./ContentComparisonCard.tsx";
import { HistoryNav } from "./HistoryNav.tsx";

export function ContentComparisonPage({
	elementKeys,
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

	return (
		<div className="page-stack">
			<PageHeader
				aside={
					<a className="ui-text-link" href={`/history/${encodeURIComponent(site)}/research`}>
						← Change selection
					</a>
				}
				description="See how selected content moved in prominence and position across the publisher page."
				title="Content trajectories"
			/>
			<HistoryNav current="research" site={site} />
			{elementKeys.length < 2 ? (
				<NoDataState
					action={
						<ButtonLink href={`/history/${encodeURIComponent(site)}/research`}>
							Choose content
						</ButtonLink>
					}
					description="Return to research and select at least two captured content items."
					title="Nothing selected for comparison"
				/>
			) : null}
			{error ? (
				<StatusMessage role="alert" tone="error">
					{error}
				</StatusMessage>
			) : null}
			{loading ? <StatusMessage role="status">Loading comparison…</StatusMessage> : null}
			<div className="comparison-grid">
				{items.map((item) => (
					<ContentComparisonCard item={item} key={item.elementKey} site={site} />
				))}
			</div>
		</div>
	);
}
