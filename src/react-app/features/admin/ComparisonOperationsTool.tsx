import { useEffect, useState } from "react";

import {
	fetchComparisonFeedback,
	fetchComparisonRuns,
	fetchHistoryExtractions,
	requeueComparisonCaptures,
	resolveComparisonFeedback,
	withdrawComparisonRevision,
	type ComparisonAnalysisRun,
	type ComparisonFeedback,
	type ExtractionSummary,
} from "../../platform/api-client.ts";
import { Button } from "../../shared/Button.tsx";
import { Card } from "../../shared/Card.tsx";
import { dateTimeLabel, displayName } from "../../shared/format.ts";

function message(reason: unknown, fallback: string): string {
	return reason instanceof Error ? reason.message : fallback;
}

function ProcessingPanel({ apiKey }: { apiKey: string }) {
	const [runs, setRuns] = useState<ComparisonAnalysisRun[]>([]);
	const [status, setStatus] = useState("");
	const [state, setState] = useState("");

	async function loadRuns(): Promise<void> {
		if (!apiKey) {
			return;
		}
		setState("Loading processing history…");
		try {
			setRuns(await fetchComparisonRuns(apiKey, status || undefined));
			setState("");
		} catch (reason) {
			setRuns([]);
			setState(message(reason, "Could not load processing history."));
		}
	}

	useEffect(() => {
		void loadRuns();
	}, [apiKey, status]);

	return (
		<section className="admin-tool comparison-admin-panel">
			<header className="admin-tool__header admin-tool__header--action">
				<div>
					<h3>Processing</h3>
					<p>Recent capture analysis, story comparison and window finalisation runs.</p>
				</div>
				<div className="comparison-admin-controls">
					<label>
						<span>Status</span>
						<select onChange={(event) => setStatus(event.target.value)} value={status}>
							<option value="">All</option>
							<option value="running">Running</option>
							<option value="pending">Pending</option>
							<option value="failed">Failed</option>
							<option value="stale">Stale</option>
							<option value="succeeded">Succeeded</option>
							<option value="abstained">Abstained</option>
						</select>
					</label>
					<Button onClick={() => void loadRuns()} variant="secondary">
						Refresh
					</Button>
				</div>
			</header>
			<p aria-live="polite" className="admin-status">
				{!apiKey ? "Enter the API key above to load comparison runs." : state}
			</p>
			{runs.length ? (
				<div className="comparison-run-list">
					{runs.map((run) => (
						<Card key={run.runId}>
							<div>
								<strong>{run.kind.replaceAll("-", " ")}</strong>
								<span data-status={run.status}>{run.status}</span>
							</div>
							<p>
								{run.site ? displayName(run.site) : (run.storyId ?? run.windowId ?? "System run")}
							</p>
							<small>
								{dateTimeLabel(run.createdAt)} · attempt {run.attemptCount}
							</small>
							{run.errorMessage ? (
								<details>
									<summary>{run.errorCode ?? "Run failed"}</summary>
									<p>{run.errorMessage}</p>
								</details>
							) : null}
						</Card>
					))}
				</div>
			) : null}
		</section>
	);
}

function FeedbackItem({
	apiKey,
	feedback,
	onResolved,
}: {
	apiKey: string;
	feedback: ComparisonFeedback;
	onResolved: () => void;
}) {
	const [resolution, setResolution] = useState("");
	const [state, setState] = useState("");
	const [busy, setBusy] = useState(false);

	async function resolve(status: "dismissed" | "resolved"): Promise<void> {
		if (resolution.trim().length < 5) {
			setState("Add a short review note first.");
			return;
		}
		setState("Saving review…");
		setBusy(true);
		try {
			await resolveComparisonFeedback(apiKey, feedback.feedbackId, {
				resolution: resolution.trim(),
				status,
			});
			onResolved();
		} catch (reason) {
			setState(message(reason, "Could not save the review."));
		} finally {
			setBusy(false);
		}
	}

	async function withdraw(): Promise<void> {
		const reason = resolution.trim();
		if (reason.length < 5 || reason.length > 500) {
			setState("Add a review note between 5 and 500 characters first.");
			return;
		}
		if (!window.confirm(`Withdraw the published revision for “${feedback.label}”?`)) {
			return;
		}
		setBusy(true);
		setState("Withdrawing revision…");
		try {
			await withdrawComparisonRevision(apiKey, feedback.revisionId, reason);
			setState("Revision withdrawn. The report remains pending for review.");
			onResolved();
		} catch (reason) {
			setState(message(reason, "Could not withdraw the revision."));
		} finally {
			setBusy(false);
		}
	}

	return (
		<Card className="comparison-feedback-item">
			<header>
				<div>
					<strong>{feedback.reason.replaceAll("-", " ")}</strong>
					<time dateTime={feedback.submittedAt}>{dateTimeLabel(feedback.submittedAt)}</time>
				</div>
				{feedback.revisionAvailable ? (
					<a
						href={
							`/compare/stories/${encodeURIComponent(feedback.storyId)}` +
							`?revision=${encodeURIComponent(feedback.revisionId)}`
						}
					>
						Open comparison
					</a>
				) : (
					<span>Source comparison was reset</span>
				)}
			</header>
			<h4>{feedback.label}</h4>
			{feedback.note ? <p>{feedback.note}</p> : <p>No note was supplied.</p>}
			{feedback.reviewStatus === "pending" ? (
				<div className="comparison-feedback-item__review">
					<label>
						<span>Review note</span>
						<input
							disabled={busy}
							maxLength={500}
							onChange={(event) => setResolution(event.target.value)}
							value={resolution}
						/>
					</label>
					<Button disabled={busy} onClick={() => void resolve("resolved")} variant="secondary">
						Resolve
					</Button>
					<Button disabled={busy} onClick={() => void resolve("dismissed")} variant="secondary">
						Dismiss
					</Button>
					{feedback.revisionAvailable ? (
						<Button disabled={busy} onClick={() => void withdraw()} variant="danger">
							Withdraw revision
						</Button>
					) : null}
				</div>
			) : (
				<p className="comparison-feedback-item__resolution">{feedback.resolution}</p>
			)}
			<p aria-live="polite" className="admin-status">
				{state}
			</p>
		</Card>
	);
}

function ReportsPanel({ apiKey }: { apiKey: string }) {
	const [feedback, setFeedback] = useState<ComparisonFeedback[]>([]);
	const [status, setStatus] = useState<"dismissed" | "pending" | "resolved">("pending");
	const [state, setState] = useState("");

	async function loadFeedback(): Promise<void> {
		if (!apiKey) {
			return;
		}
		setState("Loading reports…");
		try {
			const results = await fetchComparisonFeedback(apiKey, status);
			setFeedback(results);
			setState(results.length ? "" : "No reports match this status.");
		} catch (reason) {
			setFeedback([]);
			setState(message(reason, "Could not load reports."));
		}
	}

	useEffect(() => {
		void loadFeedback();
	}, [apiKey, status]);

	return (
		<section className="admin-tool comparison-admin-panel">
			<header className="admin-tool__header admin-tool__header--action">
				<div>
					<h3>Reports</h3>
					<p>Issues submitted from a published story comparison.</p>
				</div>
				<div className="comparison-admin-controls">
					<label>
						<span>Status</span>
						<select
							onChange={(event) => setStatus(event.target.value as typeof status)}
							value={status}
						>
							<option value="pending">Pending</option>
							<option value="resolved">Resolved</option>
							<option value="dismissed">Dismissed</option>
						</select>
					</label>
					<Button onClick={() => void loadFeedback()} variant="secondary">
						Refresh
					</Button>
				</div>
			</header>
			<p aria-live="polite" className="admin-status">
				{!apiKey ? "Enter the API key above to load reports." : state}
			</p>
			<div className="comparison-feedback-list">
				{feedback.map((item) => (
					<FeedbackItem
						apiKey={apiKey}
						feedback={item}
						key={item.feedbackId}
						onResolved={() => void loadFeedback()}
					/>
				))}
			</div>
		</section>
	);
}

function BackfillPanel({ apiKey }: { apiKey: string }) {
	const [extractions, setExtractions] = useState<ExtractionSummary[]>([]);
	const [selected, setSelected] = useState<string[]>([]);
	const [site, setSite] = useState("");
	const [state, setState] = useState("");

	async function loadExtractions(): Promise<void> {
		if (!apiKey) {
			return;
		}
		setState("Loading indexed captures…");
		try {
			const results = await fetchHistoryExtractions(apiKey, {
				limit: 50,
				site: site.trim() || undefined,
				sort: "newest",
			});
			setExtractions(results);
			setSelected([]);
			setState(results.length ? "" : "No indexed captures match this site.");
		} catch (reason) {
			setExtractions([]);
			setState(message(reason, "Could not load indexed captures."));
		}
	}

	useEffect(() => {
		void loadExtractions();
	}, [apiKey]);

	async function queueSelected(): Promise<void> {
		setState(`Queueing ${selected.length} captures…`);
		try {
			await requeueComparisonCaptures(apiKey, selected);
			setSelected([]);
			setState(`${selected.length} captures queued for comparison analysis.`);
		} catch (reason) {
			setState(message(reason, "Could not queue the selected captures."));
		}
	}

	return (
		<section className="admin-tool comparison-admin-panel">
			<header className="admin-tool__header">
				<h3>Backfill captures</h3>
				<p>Select recent indexed captures to run through the current comparison pipeline.</p>
			</header>
			<form
				className="comparison-backfill-filter"
				onSubmit={(event) => {
					event.preventDefault();
					void loadExtractions();
				}}
			>
				<label>
					<span>Site</span>
					<input
						onChange={(event) => setSite(event.target.value)}
						placeholder="All sites"
						value={site}
					/>
				</label>
				<Button disabled={!apiKey} type="submit" variant="secondary">
					Refresh
				</Button>
			</form>
			<p aria-live="polite" className="admin-status">
				{!apiKey ? "Enter the API key above to list captures." : state}
			</p>
			{extractions.length ? (
				<fieldset className="comparison-backfill-list">
					<legend className="sr-only">Captures to backfill</legend>
					{extractions.map((extraction) => (
						<label key={extraction.captureId}>
							<input
								checked={selected.includes(extraction.captureId)}
								onChange={(event) => {
									setSelected((current) =>
										event.target.checked
											? [...current, extraction.captureId]
											: current.filter((captureId) => captureId !== extraction.captureId),
									);
								}}
								type="checkbox"
							/>
							<span>
								<strong>{displayName(extraction.site)}</strong>
								<small>
									{dateTimeLabel(extraction.capturedAt)} · {extraction.device}
								</small>
							</span>
							<small>{extraction.matchedElements} elements</small>
						</label>
					))}
				</fieldset>
			) : null}
			<Button
				className="comparison-backfill-action"
				disabled={!selected.length}
				onClick={() => void queueSelected()}
			>
				Queue {selected.length || "selected"} captures
			</Button>
		</section>
	);
}

export function ComparisonOperationsTool({ apiKey }: { apiKey: string }) {
	return (
		<div className="comparison-admin">
			<ProcessingPanel apiKey={apiKey} />
			<ReportsPanel apiKey={apiKey} />
			<BackfillPanel apiKey={apiKey} />
		</div>
	);
}
