import type { CatalogueSite } from "../../core/types.ts";
import { NoDataState } from "../../shared/NoDataState.tsx";
import { PageHeader } from "../../shared/PageHeaders.tsx";
import { StatusMessage } from "../../shared/StatusMessage.tsx";
import { HistoryNav } from "./HistoryNav.tsx";
import { HistorySiteDirectory } from "./HistorySiteDirectory.tsx";
import { useHistorySites } from "./useHistorySites.ts";

export function HistoryIndexPage({ catalogue }: { catalogue: ReadonlyMap<string, CatalogueSite> }) {
	const { error, loading, sites } = useHistorySites();

	return (
		<div className="page-stack history-index-page">
			<PageHeader
				description="See what publishers led with, how their pages changed, and which items persisted."
				title="Site history"
			/>
			<HistoryNav current="sites" />
			{loading ? (
				<p aria-live="polite" className="sr-only">
					Loading site histories…
				</p>
			) : null}
			{error ? (
				<StatusMessage role="alert" tone="error">
					{error}
				</StatusMessage>
			) : null}
			{!loading && !error && sites.length === 0 ? (
				<NoDataState
					description="Publisher histories will appear here after captures have been analysed and indexed."
					title="No history available yet"
				/>
			) : null}
			{!error && (loading || sites.length > 0) ? (
				<HistorySiteDirectory catalogue={catalogue} loading={loading} sites={sites} />
			) : null}
		</div>
	);
}
