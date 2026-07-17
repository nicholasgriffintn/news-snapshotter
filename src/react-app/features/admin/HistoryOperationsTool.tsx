import { useEffect, useState } from "react";

import {
	createHistoryTimeline,
	fetchHistoryAdminStatus,
	indexHistoryArchivePage,
	type HistoryAdminStatus,
} from "../../platform/api-client.ts";

export function HistoryOperationsTool({ apiKey }: { apiKey: string }) {
	const [indexSite, setIndexSite] = useState("");
	const [indexStatus, setIndexStatus] = useState("");
	const [mode, setMode] = useState<"backfill" | "reindex">("backfill");
	const [reset, setReset] = useState(false);
	const [running, setRunning] = useState(false);
	const [status, setStatus] = useState<HistoryAdminStatus>();
	const [timelineName, setTimelineName] = useState("");
	const [timelineSite, setTimelineSite] = useState("");
	const [timelineStories, setTimelineStories] = useState("");
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
		if (!apiKey) return;
		if (reset && !window.confirm("Reset indexed history before rebuilding it from archive data?"))
			return;
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
		if (!apiKey) return;
		const storyIds = timelineStories
			.split(/\r?\n/)
			.map((value) => value.trim())
			.filter(Boolean);
		try {
			const timeline = await createHistoryTimeline(apiKey, {
				name: timelineName.trim(),
				site: timelineSite.trim(),
				storyIds,
			});
			setTimelineStatus(
				`Saved: /history/${encodeURIComponent(timelineSite.trim())}/timelines/${timeline.slug}`,
			);
		} catch (reason) {
			setTimelineStatus(reason instanceof Error ? reason.message : "Could not save timeline.");
		}
	}

	return (
		<div className="history-operations">
			<section className="admin-tool">
				<header className="admin-tool__header">
					<p className="eyebrow">Deployed index</p>
					<h2>History operations</h2>
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
					<button
						className="impact-button"
						disabled={!apiKey || running}
						onClick={() => void indexArchive()}
						type="button"
					>
						{running ? "Indexing…" : "Run on deployed archive"}
					</button>
				</div>
				<p aria-live="polite" className="admin-status">
					{!apiKey ? "Enter the API key above to manage history." : indexStatus}
				</p>
			</section>

			<section className="admin-tool">
				<header className="admin-tool__header">
					<p className="eyebrow">Editorial research</p>
					<h2>Save a timeline</h2>
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
						<span>Story IDs (one per line, 2–10)</span>
						<textarea
							onChange={(event) => setTimelineStories(event.target.value)}
							rows={8}
							value={timelineStories}
						/>
					</label>
					<button
						className="impact-button"
						disabled={!apiKey}
						onClick={() => void saveTimeline()}
						type="button"
					>
						Save public timeline
					</button>
				</div>
				<p aria-live="polite" className="admin-status">
					{timelineStatus}
				</p>
			</section>
		</div>
	);
}
