import { displayName } from "../../shared/format.ts";
import { NoDataState } from "../../shared/NoDataState.tsx";
import { PageHeader } from "../../shared/PageHeaders.tsx";
import { StatusMessage } from "../../shared/StatusMessage.tsx";
import { HistoryCaptureView } from "./HistoryCaptureView";
import { HistoryCaptureSkeleton } from "./HistoryCaptureSkeleton.tsx";
import { HistoryChangePanel } from "./HistoryChangePanel";
import { HistoryFailureNotice } from "./HistoryFailureNotice.tsx";
import { HistoryNav } from "./HistoryNav.tsx";
import { HistoryScrubber } from "./HistoryScrubber";
import { useHistoryPage } from "./useHistoryPage.ts";

export function HistoryPage({ preferredName, site }: { preferredName?: string; site: string }) {
	const history = useHistoryPage(site);
	return (
		<div className="page-stack">
			<PageHeader
				aside={
					history.capture ? (
						<a
							className="ui-text-link"
							href={history.capture.capture.sourceUrl}
							rel="noreferrer"
							target="_blank"
						>
							Visit original publisher ↗
						</a>
					) : null
				}
				description="Review each captured front page alongside its extracted content and layout."
				title={`${displayName(site, preferredName)} history`}
			/>
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
					loadingMore={history.loadingMoreFailures}
					onLoadMore={() => void history.loadMoreFailures()}
					paginationError={history.failureError}
				/>
			) : null}

			{history.loading && !history.capture ? (
				<>
					<p aria-live="polite" className="sr-only">
						Loading structured history…
					</p>
					<HistoryCaptureSkeleton />
				</>
			) : null}
			{history.error ? (
				<StatusMessage role="alert" tone="error">
					Could not load history. {history.error}
				</StatusMessage>
			) : null}
			{!history.loading && !history.error && history.captures.length === 0 ? (
				<NoDataState
					description="Once a capture has been analysed, its page structure and changes will appear here."
					title="No analysed captures available"
				/>
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
