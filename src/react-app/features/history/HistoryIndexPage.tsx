import type { CatalogueSite } from "../../core/types.ts";
import { HistoryNav } from "./HistoryNav.tsx";
import { HistorySiteDirectory } from "./HistorySiteDirectory.tsx";
import { useHistorySites } from "./useHistorySites.ts";

export function HistoryIndexPage({
	catalogue,
}: {
	catalogue: ReadonlyMap<string, CatalogueSite>;
}) {
	const { error, loading, sites } = useHistorySites();

	return (
		<div className="history-page history-index-page">
			<header className="history-heading history-heading--index">
				<div>
					<h1>Site history</h1>
				</div>
				<div className="history-heading__intro">
					<p>See what publishers led with, how their pages changed, and which items persisted.</p>
				</div>
			</header>
			<HistoryNav current="sites" />
			{loading ? <div className="empty-state">Loading site histories…</div> : null}
			{error ? <div className="empty-state empty-state--error">{error}</div> : null}
			{!loading && !error && sites.length === 0 ? (
				<div className="empty-state">No analysed site histories are available yet.</div>
			) : null}
			{!loading && !error && sites.length > 0 ? (
				<HistorySiteDirectory catalogue={catalogue} sites={sites} />
			) : null}
		</div>
	);
}
