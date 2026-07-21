import { useEffect, useState } from "react";

import {
	clearHistoryExtractionFailures,
	fetchHistoryExtractionFailures,
	type HistoryExtractionFailure,
} from "../../platform/api-client.ts";
import { Button } from "../../shared/Button.tsx";
import { dateTimeLabel, displayName } from "../../shared/format.ts";

export function HistoryFailureDiagnostics({
	apiKey,
	initialSite = "",
}: {
	apiKey: string;
	initialSite?: string;
}) {
	const [cursor, setCursor] = useState<string>();
	const [failures, setFailures] = useState<HistoryExtractionFailure[]>([]);
	const [loading, setLoading] = useState(false);
	const [clearing, setClearing] = useState(false);
	const [site, setSite] = useState(initialSite);
	const [status, setStatus] = useState("");

	async function loadFailures(append = false): Promise<void> {
		if (!apiKey || (append && !cursor)) {
			return;
		}
		setLoading(true);
		setStatus("Loading private failure details…");
		try {
			const page = await fetchHistoryExtractionFailures(apiKey, {
				cursor: append ? cursor : undefined,
				site: site.trim() || undefined,
			});
			setCursor(page.cursor);
			setFailures((current) => (append ? [...current, ...page.failures] : page.failures));
			setStatus(page.failures.length === 0 ? "No extraction failures match this site." : "");
		} catch (reason) {
			setStatus(reason instanceof Error ? reason.message : "Could not load extraction failures.");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		if (!apiKey) {
			setCursor(undefined);
			setFailures([]);
			return;
		}
		let active = true;
		setLoading(true);
		setStatus("Loading private failure details…");
		fetchHistoryExtractionFailures(apiKey, { site: initialSite || undefined })
			.then((page) => {
				if (active) {
					setCursor(page.cursor);
					setFailures(page.failures);
					setStatus(page.failures.length === 0 ? "No extraction failures match this site." : "");
				}
			})
			.catch((reason: unknown) => {
				if (active) {
					setStatus(
						reason instanceof Error ? reason.message : "Could not load extraction failures.",
					);
				}
			})
			.finally(() => {
				if (active) {
					setLoading(false);
				}
			});
		return () => {
			active = false;
		};
	}, [apiKey, initialSite]);

	async function clearFailures(): Promise<void> {
		const selectedSite = site.trim();
		const scope = selectedSite ? ` for ${selectedSite}` : " across every site";
		if (!apiKey || !window.confirm(`Clear all extraction failures${scope}?`)) {
			return;
		}
		setClearing(true);
		setStatus("Clearing extraction failures…");
		try {
			const cleared = await clearHistoryExtractionFailures(apiKey, selectedSite || undefined);
			setCursor(undefined);
			setFailures([]);
			setStatus(`Cleared ${cleared} extraction ${cleared === 1 ? "failure" : "failures"}${scope}.`);
		} catch (reason) {
			setStatus(reason instanceof Error ? reason.message : "Could not clear extraction failures.");
		} finally {
			setClearing(false);
		}
	}

	return (
		<section className="admin-tool history-failure-diagnostics">
			<header className="admin-tool__header admin-tool__header--action">
				<div>
					<h3>Extraction failures</h3>
					<p>Review the private error before recapturing or backfilling a site.</p>
				</div>
				<Button
					disabled={!apiKey || loading || clearing}
					onClick={() => void clearFailures()}
					variant="danger"
				>
					{clearing ? "Clearing…" : site.trim() ? "Clear this site" : "Clear all"}
				</Button>
			</header>
			<form
				className="history-failure-diagnostics__filter"
				onSubmit={(event) => {
					event.preventDefault();
					void loadFailures();
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
				<Button disabled={!apiKey || loading || clearing} type="submit" variant="secondary">
					Review failures
				</Button>
			</form>
			<p aria-live="polite" className="admin-status">
				{!apiKey ? "Enter the API key above to view private diagnostics." : status}
			</p>
			{failures.length > 0 ? (
				<ul className="history-failure-diagnostics__list">
					{failures.map((failure) => (
						<li key={failure.failureId}>
							<div>
								<strong>{displayName(failure.site ?? "Unknown site")}</strong>
								<time dateTime={failure.failedAt}>{dateTimeLabel(failure.failedAt)}</time>
								<small>
									{failure.stage} · {failure.device ?? "unknown device"}
								</small>
							</div>
							<p>{failure.message}</p>
							<code>{failure.captureId ?? failure.extractionKey ?? "Unknown capture"}</code>
						</li>
					))}
				</ul>
			) : null}
			{cursor ? (
				<Button disabled={loading} onClick={() => void loadFailures(true)} variant="secondary">
					{loading ? "Loading…" : "Load older failures"}
				</Button>
			) : null}
		</section>
	);
}
