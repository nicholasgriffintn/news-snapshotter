import { useCallback, useEffect, useMemo, useState } from "react";

import { clearCaptureFailures, fetchCaptureFailures } from "../../platform/api-client.ts";
import { dateTimeLabel, displayName } from "../../shared/format.ts";
import type { CaptureFailure } from "../../core/types.ts";

export function FailureLog({ apiKey, initialSite = "" }: { apiKey: string; initialSite?: string }) {
	const [failures, setFailures] = useState<CaptureFailure[]>([]);
	const [cursor, setCursor] = useState<string>();
	const [hasMore, setHasMore] = useState(false);
	const [query, setQuery] = useState(initialSite);
	const [reason, setReason] = useState("all");
	const [status, setStatus] = useState("");
	const [loading, setLoading] = useState(false);
	const [clearing, setClearing] = useState(false);

	const reasons = useMemo(
		() => [...new Set(failures.map((failure) => failure.reason))].sort(),
		[failures],
	);
	const visibleFailures = useMemo(() => {
		const search = query.trim().toLowerCase();
		return failures.filter((failure) => {
			if (reason !== "all" && failure.reason !== reason) {
				return false;
			}
			if (!search) {
				return true;
			}
			return [failure.brand, failure.name, failure.message, failure.url].some((value) =>
				value.toLowerCase().includes(search),
			);
		});
	}, [failures, query, reason]);

	const load = useCallback(
		async (nextCursor?: string, append = false) => {
			if (!apiKey) {
				return;
			}
			setLoading(true);
			setStatus(append ? "Loading more failures…" : "Loading failures…");
			try {
				const page = await fetchCaptureFailures(apiKey, nextCursor);
				setFailures((current) => (append ? [...current, ...page.failures] : page.failures));
				setCursor(page.cursor);
				setHasMore(page.hasMore);
				setStatus(page.failures.length === 0 && !append ? "No capture failures found." : "");
			} catch (error) {
				setStatus(error instanceof Error ? error.message : "Could not load capture failures.");
			} finally {
				setLoading(false);
			}
		},
		[apiKey],
	);

	useEffect(() => {
		setFailures([]);
		setCursor(undefined);
		setHasMore(false);
		if (apiKey) {
			void load();
		}
	}, [apiKey, load]);

	async function clearFailures(): Promise<void> {
		if (!apiKey || !window.confirm("Clear every stored capture failure?")) {
			return;
		}
		setClearing(true);
		setStatus("Clearing capture failures…");
		try {
			const cleared = await clearCaptureFailures(apiKey);
			setFailures([]);
			setCursor(undefined);
			setHasMore(false);
			setStatus(`Cleared ${cleared} capture ${cleared === 1 ? "failure" : "failures"}.`);
		} catch (error) {
			setStatus(error instanceof Error ? error.message : "Could not clear capture failures.");
		} finally {
			setClearing(false);
		}
	}

	return (
		<section className="admin-tool failure-log">
			<header className="admin-tool__header admin-tool__header--action">
				<h3>Recent capture failures</h3>
				<div className="admin-tool__actions">
					<button
						className="admin-secondary-button"
						disabled={!apiKey || loading || clearing}
						onClick={() => void load()}
						type="button"
					>
						Refresh
					</button>
					<button
						className="admin-secondary-button admin-secondary-button--danger"
						disabled={!apiKey || loading || clearing}
						onClick={() => void clearFailures()}
						type="button"
					>
						{clearing ? "Clearing…" : "Clear all"}
					</button>
				</div>
			</header>

			<div className="failure-log__filters">
				<label>
					<span>Search</span>
					<input
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Publisher, site, message or URL"
						type="search"
						value={query}
					/>
				</label>
				<label>
					<span>Reason</span>
					<select onChange={(event) => setReason(event.target.value)} value={reason}>
						<option value="all">All reasons</option>
						{reasons.map((value) => (
							<option key={value} value={value}>
								{displayName(value)}
							</option>
						))}
					</select>
				</label>
			</div>

			<p aria-live="polite" className="admin-status">
				{!apiKey ? "Enter the API key above to view failures." : status}
			</p>

			{visibleFailures.length > 0 ? (
				<div className="failure-list">
					{visibleFailures.map((failure) => (
						<article
							className="failure-item"
							key={`${failure.capturedAt}-${failure.name}-${failure.device}`}
						>
							<div className="failure-item__heading">
								<div>
									<strong>{displayName(failure.name)}</strong>
									<span>
										{displayName(failure.brand)} · {failure.device} · {failure.category}
									</span>
								</div>
								<span className="failure-item__reason">{displayName(failure.reason)}</span>
							</div>
							<p>{failure.message}</p>
							<div className="failure-item__meta">
								<time dateTime={failure.capturedAt}>{dateTimeLabel(failure.capturedAt)}</time>
								<a href={failure.url} rel="noreferrer" target="_blank">
									Open publisher ↗
								</a>
							</div>
						</article>
					))}
				</div>
			) : null}

			{hasMore ? (
				<button
					className="admin-secondary-button"
					disabled={loading || !cursor}
					onClick={() => void load(cursor, true)}
					type="button"
				>
					Load more
				</button>
			) : null}
		</section>
	);
}
