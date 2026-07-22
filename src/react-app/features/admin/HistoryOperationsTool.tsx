import { useEffect, useState } from "react";

import {
	fetchHistoryAdminStatus,
	indexHistoryArchivePage,
	type HistoryAdminStatus,
} from "../../platform/api-client.ts";
import { Button } from "../../shared/Button.tsx";
import { TimelineManagementTool } from "./TimelineManagementTool.tsx";

export function HistoryOperationsTool({
	apiKey,
	initialSite = "",
}: {
	apiKey: string;
	initialSite?: string;
}) {
	const [indexSite, setIndexSite] = useState(initialSite);
	const [indexStatus, setIndexStatus] = useState("");
	const [mode, setMode] = useState<"backfill" | "reindex">("backfill");
	const [reset, setReset] = useState(false);
	const [running, setRunning] = useState(false);
	const [status, setStatus] = useState<HistoryAdminStatus>();

	useEffect(() => {
		if (!apiKey) {
			setStatus(undefined);
			return;
		}
		fetchHistoryAdminStatus(apiKey)
			.then(setStatus)
			.catch(() => setIndexStatus("Could not load history status."));
	}, [apiKey]);

	async function indexArchive(): Promise<void> {
		if (!apiKey) {
			return;
		}
		if (reset && !window.confirm("Reset indexed history before rebuilding it from archive data?")) {
			return;
		}
		setRunning(true);
		setIndexStatus("Scanning archive data…");
		let cursor: string | undefined;
		let enqueued = 0;
		let scanned = 0;
		let pages = 0;
		try {
			do {
				const page = await indexHistoryArchivePage(apiKey, {
					cursor,
					mode,
					reset: reset && pages === 0,
					site: indexSite.trim() || undefined,
				});
				cursor = page.cursor;
				enqueued += page.enqueued;
				scanned += page.scanned;
				pages += 1;
				setIndexStatus(`Scanned ${scanned} objects; queued ${enqueued} history records…`);
			} while (cursor);
			setIndexStatus(
				`Archive scan finished: scanned ${scanned} objects and queued ${enqueued} history records. ` +
					"Indexing continues asynchronously.",
			);
			setStatus(await fetchHistoryAdminStatus(apiKey));
		} catch (reason) {
			setIndexStatus(reason instanceof Error ? reason.message : "History operation failed.");
		} finally {
			setRunning(false);
		}
	}

	return (
		<div className="history-operations">
			<section className="admin-tool history-operation--wide">
				<header className="admin-tool__header">
					<h3>Archive index</h3>
				</header>
				{status ? (
					<div className="history-admin-totals">
						{Object.entries(status.totals).map(([label, value]) => (
							<span key={label}>
								<strong>{value}</strong>
								{label}
							</span>
						))}
					</div>
				) : null}
				<div className="history-operation-form">
					<label>
						<span>Operation</span>
						<select
							onChange={(event) =>
								setMode(event.target.value === "reindex" ? "reindex" : "backfill")
							}
							value={mode}
						>
							<option value="backfill">Backfill missing records</option>
							<option value="reindex">Reindex archive records</option>
						</select>
					</label>
					<label>
						<span>Site (optional)</span>
						<input
							onChange={(event) => setIndexSite(event.target.value)}
							placeholder="bbc-home"
							value={indexSite}
						/>
					</label>
					<label className="history-reset">
						<input
							checked={reset}
							onChange={(event) => setReset(event.target.checked)}
							type="checkbox"
						/>{" "}
						Reset current index first
					</label>
					<Button disabled={!apiKey || running} onClick={() => void indexArchive()}>
						{running ? "Indexing…" : "Run on deployed archive"}
					</Button>
				</div>
				<p aria-live="polite" className="admin-status">
					{!apiKey ? "Enter the API key above to manage history." : indexStatus}
				</p>
			</section>

			<TimelineManagementTool
				apiKey={apiKey}
				initialSite={initialSite}
				sites={status?.sites.map(({ site }) => site) ?? []}
			/>

			{status?.resourceUsage.map((usage) => (
				<section className="admin-tool" key={usage.site}>
					<header className="admin-tool__header">
						<h3>{usage.site}</h3>
					</header>
					<div className="history-admin-totals">
						<span>
							<strong>{usage.indexedCaptures}</strong>captures
						</span>
						<span>
							<strong>{Math.round(usage.compressedExtractionBytes / 1024)}</strong>compressed KiB
						</span>
						<span>
							<strong>{usage.indexedElements}</strong>elements
						</span>
						<span>
							<strong>{usage.indexedChanges}</strong>changes
						</span>
						<span>
							<strong>{usage.d1WriteStatements}</strong>D1 writes
						</span>
					</div>
				</section>
			))}
		</div>
	);
}
