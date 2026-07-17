import { useEffect, useState } from "react";

import type { HistorySite } from "../../core/types.ts";
import { fetchHistorySites } from "../../platform/api-client.ts";
import { displayName } from "../../shared/format.ts";

export function HistoryIndexPage() {
	const [sites, setSites] = useState<HistorySite[]>([]);
	const [error, setError] = useState<string>();
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchHistorySites()
			.then(setSites)
			.catch((reason: unknown) => {
				setError(reason instanceof Error ? reason.message : "Could not load history sites");
			})
			.finally(() => setLoading(false));
	}, []);

	return (
		<div className="history-page history-index-page">
			<header className="history-heading">
				<div>
					<p className="eyebrow">Structured page archive</p>
					<h1>Site history</h1>
				</div>
				<p>Explore how publisher front pages, stories and editorial emphasis changed over time.</p>
			</header>
			{loading ? <div className="empty-state">Loading site histories…</div> : null}
			{error ? <div className="empty-state empty-state--error">{error}</div> : null}
			{!loading && !error && sites.length === 0 ? (
				<div className="empty-state">No analysed site histories are available yet.</div>
			) : null}
			<div className="history-site-grid">
				{sites.map((site) => (
					<a href={`/history/${encodeURIComponent(site.site)}`} key={site.site}>
						<p className="eyebrow">{site.captureCount} captures</p>
						<h2>{displayName(site.site)}</h2>
						<span>{site.storyCount} observed stories</span>
						<time dateTime={site.lastCaptureAt}>
							Updated {new Date(site.lastCaptureAt).toLocaleString("en-GB")}
						</time>
					</a>
				))}
			</div>
		</div>
	);
}
