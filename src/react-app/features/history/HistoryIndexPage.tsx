import { useEffect, useState } from "react";

import { isAbortError } from "../../shared/errors.ts";
import type { HistorySite } from "../../core/types.ts";
import { fetchHistorySites } from "../../platform/api-client.ts";
import { displayName } from "../../shared/format.ts";
import { HistoryNav } from "./HistoryNav.tsx";

export function HistoryIndexPage() {
	const [sites, setSites] = useState<HistorySite[]>([]);
	const [error, setError] = useState<string>();
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const controller = new AbortController();
		fetchHistorySites({ signal: controller.signal })
			.then((nextSites) => {
				if (!controller.signal.aborted) {
					setSites(nextSites);
				}
			})
			.catch((reason: unknown) => {
				if (!isAbortError(reason)) {
					setError(reason instanceof Error ? reason.message : "Could not load history sites");
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setLoading(false);
				}
			});
		return () => controller.abort();
	}, []);

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
			<div className="history-site-list">
				{sites.map((site, index) => (
					<a
						className="history-site-row"
						href={`/history/${encodeURIComponent(site.site)}`}
						key={site.site}
					>
						<span className="history-site-row__index">{String(index + 1).padStart(2, "0")}</span>
						<div>
							<h2>{displayName(site.site)}</h2>
						</div>
						<dl>
							<div>
								<dt>Captures</dt>
								<dd>{site.captureCount}</dd>
							</div>
							<div>
								<dt>Content items</dt>
								<dd>{site.contentCount}</dd>
							</div>
							<div className="history-site-row__updated">
								<dt>Latest</dt>
								<dd>
									<time dateTime={site.lastCaptureAt}>
										{new Date(site.lastCaptureAt).toLocaleString("en-GB")}
									</time>
								</dd>
							</div>
						</dl>
						<span className="history-site-row__action">Open history →</span>
					</a>
				))}
			</div>
		</div>
	);
}
