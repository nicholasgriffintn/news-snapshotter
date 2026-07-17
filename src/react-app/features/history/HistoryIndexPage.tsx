import { useEffect, useState } from "react";

import type { HistorySite } from "../../core/types.ts";
import { fetchHistorySites } from "../../platform/api-client.ts";
import { displayName } from "../../shared/format.ts";
import { HistoryNav } from "./HistoryNav.tsx";

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
			<header className="history-heading history-heading--index">
				<div>
					<p className="eyebrow">Structured page archive</p>
					<h1>Site history</h1>
				</div>
				<div className="history-heading__intro">
					<p>See what publishers led with, how their pages changed, and which stories persisted.</p>
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
							<p className="eyebrow">Publisher archive</p>
							<h2>{displayName(site.site)}</h2>
						</div>
						<dl>
							<div>
								<dt>Captures</dt>
								<dd>{site.captureCount}</dd>
							</div>
							<div>
								<dt>Stories</dt>
								<dd>{site.storyCount}</dd>
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
