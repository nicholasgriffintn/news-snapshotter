import { useEffect, useState } from "react";

import {
	createHistoryTimeline,
	fetchHistoryAdminStatus,
	indexHistoryArchivePage,
	materialiseHistoryAggregates,
	type HistoryAdminStatus,
} from "../../platform/api-client.ts";
import { Button } from "../../shared/Button.tsx";

export function HistoryOperationsTool({
	apiKey,
	initialSite = "",
}: {
	apiKey: string;
	initialSite?: string;
}) {
	const [aggregateMonth, setAggregateMonth] = useState(new Date().toISOString().slice(0, 7));
	const [aggregateSite, setAggregateSite] = useState("");
	const [aggregateStatus, setAggregateStatus] = useState("");
	const [indexSite, setIndexSite] = useState(initialSite);
	const [indexStatus, setIndexStatus] = useState("");
	const [mode, setMode] = useState<"backfill" | "reindex">("backfill");
	const [reset, setReset] = useState(false);
	const [running, setRunning] = useState(false);
	const [status, setStatus] = useState<HistoryAdminStatus>();
	const [timelineName, setTimelineName] = useState("");
	const [timelineSite, setTimelineSite] = useState("");
	const [timelineContent, setTimelineContent] = useState("");
	const [timelineStatus, setTimelineStatus] = useState("");

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
				`Complete: scanned ${scanned} objects and queued ${enqueued} history records.`,
			);
			setStatus(await fetchHistoryAdminStatus(apiKey));
		} catch (reason) {
			setIndexStatus(reason instanceof Error ? reason.message : "History operation failed.");
		} finally {
			setRunning(false);
		}
	}

	async function saveTimeline(): Promise<void> {
		if (!apiKey) {
			return;
		}
		const elementKeys = timelineContent
			.split(/\r?\n/)
			.map((value) => value.trim())
			.filter(Boolean);
		try {
			const timeline = await createHistoryTimeline(apiKey, {
				name: timelineName.trim(),
				site: timelineSite.trim(),
				elementKeys,
			});
			setTimelineStatus(
				`Saved: /history/${encodeURIComponent(timelineSite.trim())}/timelines/${timeline.slug}`,
			);
		} catch (reason) {
			setTimelineStatus(reason instanceof Error ? reason.message : "Could not save timeline.");
		}
	}

	async function buildAggregates(): Promise<void> {
		if (!apiKey) {
			return;
		}
		try {
			const result = await materialiseHistoryAggregates(apiKey, {
				month: aggregateMonth,
				site: aggregateSite.trim(),
			});
			setAggregateStatus(`Materialised ${result.rows} aggregate rows.`);
		} catch (reason) {
			setAggregateStatus(reason instanceof Error ? reason.message : "Could not build aggregates.");
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

			<section className="admin-tool">
				<header className="admin-tool__header">
					<h3>Save a timeline</h3>
				</header>
				<div className="history-operation-form">
					<label>
						<span>Name</span>
						<input onChange={(event) => setTimelineName(event.target.value)} value={timelineName} />
					</label>
					<label>
						<span>Site</span>
						<input
							onChange={(event) => setTimelineSite(event.target.value)}
							placeholder="bbc-home"
							value={timelineSite}
						/>
					</label>
					<label className="history-story-ids">
						<span>Content keys (one per line, 2–10)</span>
						<textarea
							onChange={(event) => setTimelineContent(event.target.value)}
							rows={8}
							value={timelineContent}
						/>
					</label>
					<Button disabled={!apiKey} onClick={() => void saveTimeline()}>
						Save public timeline
					</Button>
				</div>
				<p aria-live="polite" className="admin-status">
					{timelineStatus}
				</p>
			</section>

			<section className="admin-tool">
				<header className="admin-tool__header">
					<h3>Monthly aggregates</h3>
				</header>
				<div className="history-operation-form">
					<label>
						<span>Site</span>
						<input
							onChange={(event) => setAggregateSite(event.target.value)}
							placeholder="bbc-home"
							value={aggregateSite}
						/>
					</label>
					<label>
						<span>Month</span>
						<input
							onChange={(event) => setAggregateMonth(event.target.value)}
							type="month"
							value={aggregateMonth}
						/>
					</label>
					<Button
						disabled={!apiKey || !aggregateSite.trim()}
						onClick={() => void buildAggregates()}
					>
						Materialise month
					</Button>
				</div>
				<p aria-live="polite" className="admin-status">
					{aggregateStatus}
				</p>
			</section>

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
