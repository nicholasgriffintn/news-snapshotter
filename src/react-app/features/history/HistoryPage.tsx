import { displayName } from "../../shared/format.ts";
import { HistoryCaptureView } from "./HistoryCaptureView";
import { HistoryChangePanel } from "./HistoryChangePanel";
import { HistoryFailureNotice } from "./HistoryFailureNotice.tsx";
import { HistoryNav } from "./HistoryNav.tsx";
import { HistoryScrubber } from "./HistoryScrubber";
import { useHistoryPage } from "./useHistoryPage.ts";

export function HistoryPage({ preferredName, site }: { preferredName?: string; site: string }) {
	const history = useHistoryPage(site);
	return (
		<div className="history-page">
			<header className="history-heading history-heading--archive">
				<div>
					<h1>{displayName(site, preferredName)} history</h1>
				</div>
				<div className="history-heading__intro">
					<p>Review each captured front page alongside its extracted content and layout.</p>
					{history.capture ? (
						<a
							className="history-text-link"
							href={history.capture.capture.sourceUrl}
							rel="noreferrer"
							target="_blank"
						>
							Visit original publisher ↗
						</a>
					) : null}
				</div>
			</header>
			<HistoryNav current="captures" site={site} />

			<HistoryScrubber
				captures={history.captures}
				hasOlder={Boolean(history.captureCursor)}
				loadingOlder={history.loadingOlder}
				onLoadOlder={history.loadOlder}
				onSelect={history.selectCapture}
				selectedCapturedAt={history.capture?.capture.capturedAt}
				selectedId={history.selection.captureId}
			/>

			{history.failures.length > 0 ? (
				<HistoryFailureNotice
					failures={history.failures}
					hasMore={Boolean(history.failureCursor)}
				/>
			) : null}

			{history.loading && !history.capture ? (
				<div className="empty-state">Loading structured history…</div>
			) : null}
			{history.error ? (
				<div className="empty-state empty-state--error">
					Could not load history. {history.error}
				</div>
			) : null}
			{!history.loading && !history.error && history.captures.length === 0 ? (
				<div className="empty-state">No analysed captures are available for this site.</div>
			) : null}

			{history.capture ? (
				<>
					<div className="history-capture-meta">
						<time dateTime={history.capture.capture.capturedAt}>
							{new Date(history.capture.capture.capturedAt).toLocaleString("en-GB", {
								dateStyle: "full",
								timeStyle: "long",
							})}
						</time>
						<span>
							Extractor {history.capture.capture.extractor.name} v
							{history.capture.capture.extractor.version} · schema{" "}
							{history.capture.capture.schemaVersion}
						</span>
					</div>
					<HistoryCaptureView
						capture={history.capture}
						onToggleOverlay={history.toggleOverlay}
						overlay={history.selection.overlay}
					/>
					<HistoryChangePanel changes={history.changes} />
				</>
			) : null}
		</div>
	);
}
