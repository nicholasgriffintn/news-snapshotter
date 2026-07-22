import { useCallback, useEffect, useRef, useState } from "react";

import type { HistorySearchResult, SavedTimelineRecord } from "../../core/types.ts";
import {
	createHistoryTimeline,
	deleteHistoryTimeline,
	fetchAdminHistoryTimelines,
	searchHistory,
	updateHistoryTimeline,
} from "../../platform/api-client.ts";
import { Button, ButtonLink } from "../../shared/Button.tsx";
import { isAbortError } from "../../shared/errors.ts";
import { dateTimeLabel, displayName } from "../../shared/format.ts";
import { savedTimelinePath } from "../history/saved-timeline.ts";
import {
	addTimelineElement,
	createRequestGate,
	defaultTimelineSite,
	removeTimelineElement,
} from "./timeline-editor.ts";

function resultLabel(result: HistorySearchResult): string {
	return result.headline ?? `${displayName(result.kind)} — ${result.elementKey}`;
}

type AdminCredential = string;

type TimelineManagementToolProps = {
	apiKey: AdminCredential;
	initialSite?: string;
	sites: string[];
};

export function TimelineManagementTool({
	apiKey,
	initialSite = "",
	sites,
}: TimelineManagementToolProps) {
	const defaultSite = defaultTimelineSite(sites, initialSite);
	const [timelines, setTimelines] = useState<SavedTimelineRecord[]>([]);
	const [loadingTimelines, setLoadingTimelines] = useState(false);
	const [timelineError, setTimelineError] = useState("");
	const [editingTimelineId, setEditingTimelineId] = useState<string>();
	const [name, setName] = useState("");
	const [site, setSite] = useState(defaultSite);
	const [selectedElementKeys, setSelectedElementKeys] = useState<string[]>([]);
	const [selectedLabels, setSelectedLabels] = useState<Record<string, string>>({});
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<HistorySearchResult[]>([]);
	const [searching, setSearching] = useState(false);
	const [searchError, setSearchError] = useState("");
	const [saving, setSaving] = useState(false);
	const [status, setStatus] = useState("");
	const [publishedPath, setPublishedPath] = useState("");
	const timelineRequests = useRef(createRequestGate());
	const searchRequests = useRef(createRequestGate());

	const loadTimelines = useCallback(async () => {
		if (!apiKey) {
			timelineRequests.current.cancel();
			setTimelines([]);
			setLoadingTimelines(false);
			setTimelineError("");
			return;
		}
		const request = timelineRequests.current.start();
		setLoadingTimelines(true);
		setTimelineError("");
		try {
			const records = await fetchAdminHistoryTimelines(apiKey, { signal: request.signal });
			if (timelineRequests.current.isCurrent(request)) {
				setTimelines(records);
			}
		} catch (reason) {
			if (timelineRequests.current.isCurrent(request) && !isAbortError(reason)) {
				setTimelineError(reason instanceof Error ? reason.message : "Could not load timelines.");
			}
		} finally {
			if (timelineRequests.current.isCurrent(request)) {
				setLoadingTimelines(false);
			}
		}
	}, [apiKey]);

	useEffect(() => {
		void loadTimelines();
		return () => timelineRequests.current.cancel();
	}, [loadTimelines]);

	useEffect(() => () => searchRequests.current.cancel(), []);

	useEffect(() => {
		if (!site && defaultSite) {
			setSite(defaultSite);
		}
	}, [defaultSite, site]);

	function resetEditor(): void {
		setEditingTimelineId(undefined);
		setName("");
		setSite(defaultSite);
		setSelectedElementKeys([]);
		setSelectedLabels({});
		setQuery("");
		setResults([]);
		setSearchError("");
		setStatus("");
		setPublishedPath("");
	}

	function changeSite(nextSite: string): void {
		searchRequests.current.cancel();
		setSearching(false);
		setSite(nextSite);
		setSelectedElementKeys([]);
		setSelectedLabels({});
		setResults([]);
		setSearchError("");
		setPublishedPath("");
	}

	async function runSearch(): Promise<void> {
		const nextQuery = query.trim();
		if (!site || !nextQuery) {
			setSearchError("Choose a site and enter search terms.");
			return;
		}
		setSearching(true);
		setSearchError("");
		const request = searchRequests.current.start();
		try {
			const page = await searchHistory({ query: nextQuery, site }, { signal: request.signal });
			if (!searchRequests.current.isCurrent(request)) {
				return;
			}
			setResults(page.results);
			setSelectedLabels((current) => {
				const next = { ...current };
				for (const result of page.results) {
					next[result.elementKey] = resultLabel(result);
				}
				return next;
			});
		} catch (reason) {
			if (searchRequests.current.isCurrent(request) && !isAbortError(reason)) {
				setResults([]);
				setSearchError(reason instanceof Error ? reason.message : "Could not search history.");
			}
		} finally {
			if (searchRequests.current.isCurrent(request)) {
				setSearching(false);
			}
		}
	}

	function addResult(result: HistorySearchResult): void {
		setSelectedElementKeys((current) => addTimelineElement(current, result.elementKey));
		setSelectedLabels((current) => ({ ...current, [result.elementKey]: resultLabel(result) }));
	}

	function editTimeline(timeline: SavedTimelineRecord): void {
		setEditingTimelineId(timeline.timelineId);
		setName(timeline.name);
		setSite(timeline.site);
		setSelectedElementKeys(timeline.elementKeys);
		setSelectedLabels(Object.fromEntries(timeline.elementKeys.map((key) => [key, key])));
		setQuery("");
		setResults([]);
		setSearchError("");
		setStatus(`Editing ${timeline.name}`);
		setPublishedPath(savedTimelinePath(timeline.site, timeline.slug));
	}

	async function saveTimeline(): Promise<void> {
		if (!apiKey) {
			return;
		}
		if (!name.trim() || !site || selectedElementKeys.length < 2) {
			setStatus("Enter a name and select at least two content items.");
			return;
		}
		setSaving(true);
		setStatus(editingTimelineId ? "Updating timeline…" : "Publishing timeline…");
		try {
			const input = { elementKeys: selectedElementKeys, name: name.trim(), site };
			if (editingTimelineId) {
				await updateHistoryTimeline(apiKey, editingTimelineId, input);
				const existing = timelines.find(({ timelineId }) => timelineId === editingTimelineId);
				setPublishedPath(existing ? savedTimelinePath(site, existing.slug) : "");
				setStatus("Timeline updated.");
			} else {
				const created = await createHistoryTimeline(apiKey, input);
				setPublishedPath(savedTimelinePath(site, created.slug));
				setStatus("Timeline published.");
			}
			await loadTimelines();
		} catch (reason) {
			setStatus(reason instanceof Error ? reason.message : "Could not save timeline.");
		} finally {
			setSaving(false);
		}
	}

	async function removeTimeline(timeline: SavedTimelineRecord): Promise<void> {
		if (!apiKey || !window.confirm(`Delete “${timeline.name}”? This removes its public page.`)) {
			return;
		}
		setTimelineError("");
		try {
			await deleteHistoryTimeline(apiKey, timeline.timelineId);
			if (editingTimelineId === timeline.timelineId) {
				resetEditor();
			}
			await loadTimelines();
		} catch (reason) {
			setTimelineError(reason instanceof Error ? reason.message : "Could not delete timeline.");
		}
	}

	return (
		<section className="admin-tool history-operation--wide timeline-manager">
			<header className="admin-tool__header admin-tool__header--action">
				<div>
					<h3>Published timelines</h3>
					<p>Create curated public timelines, update their content or remove records.</p>
				</div>
				{editingTimelineId ? (
					<Button onClick={resetEditor} variant="secondary">
						Create another
					</Button>
				) : null}
			</header>

			<div className="timeline-manager__layout">
				<div className="timeline-editor">
					<div className="history-operation-form timeline-editor__details">
						<label>
							<span>Name</span>
							<input
								maxLength={120}
								onChange={(event) => setName(event.target.value)}
								placeholder="Election coverage"
								value={name}
							/>
						</label>
						<label>
							<span>Site</span>
							<select
								disabled={sites.length === 0}
								onChange={(event) => changeSite(event.target.value)}
								value={site}
							>
								{sites.length === 0 ? <option value="">No indexed sites</option> : null}
								{sites.map((siteName) => (
									<option key={siteName} value={siteName}>
										{displayName(siteName)}
									</option>
								))}
							</select>
						</label>
					</div>

					<form
						aria-label="Find timeline content"
						className="timeline-editor__search"
						onSubmit={(event) => {
							event.preventDefault();
							void runSearch();
						}}
					>
						<label>
							<span>Search captured content</span>
							<input
								disabled={!site}
								maxLength={200}
								onChange={(event) => setQuery(event.target.value)}
								placeholder="Person, place, topic or phrase"
								value={query}
							/>
						</label>
						<Button
							disabled={!site || !query.trim() || searching}
							type="submit"
							variant="secondary"
						>
							{searching ? "Searching…" : "Search"}
						</Button>
					</form>
					{searchError ? (
						<p className="admin-status" role="alert">
							{searchError}
						</p>
					) : null}
					{results.length > 0 ? (
						<ul className="timeline-search-results">
							{results.map((result) => {
								const selected = selectedElementKeys.includes(result.elementKey);
								return (
									<li key={result.elementKey}>
										<div>
											<strong>{resultLabel(result)}</strong>
											<span>
												{displayName(result.kind)} · Page position {result.rank}
											</span>
										</div>
										<Button
											aria-label={`Add ${resultLabel(result)} to timeline`}
											disabled={selected || selectedElementKeys.length >= 10}
											onClick={() => addResult(result)}
											variant="secondary"
										>
											{selected ? "Added" : "Add"}
										</Button>
									</li>
								);
							})}
						</ul>
					) : null}

					<div className="timeline-selection">
						<div className="timeline-selection__header">
							<strong>Selected content</strong>
							<span>{selectedElementKeys.length}/10</span>
						</div>
						{selectedElementKeys.length === 0 ? (
							<p>Search above and add between two and ten items.</p>
						) : (
							<ol>
								{selectedElementKeys.map((elementKey) => (
									<li key={elementKey}>
										<span title={elementKey}>{selectedLabels[elementKey] ?? elementKey}</span>
										<Button
											aria-label={`Remove ${selectedLabels[elementKey] ?? elementKey} from timeline`}
											onClick={() =>
												setSelectedElementKeys((current) =>
													removeTimelineElement(current, elementKey),
												)
											}
											variant="quiet"
										>
											Remove
										</Button>
									</li>
								))}
							</ol>
						)}
					</div>

					<div className="timeline-editor__actions">
						<Button
							disabled={
								!apiKey || saving || !name.trim() || !site || selectedElementKeys.length < 2
							}
							onClick={() => void saveTimeline()}
						>
							{saving ? "Saving…" : editingTimelineId ? "Update timeline" : "Publish timeline"}
						</Button>
						{editingTimelineId ? (
							<Button onClick={resetEditor} variant="quiet">
								Cancel editing
							</Button>
						) : null}
					</div>
					<p aria-live="polite" className="admin-status">
						{status}{" "}
						{publishedPath ? (
							<a href={publishedPath} rel="noreferrer" target="_blank">
								Open public timeline
							</a>
						) : null}
					</p>
				</div>

				<div className="timeline-records">
					<h4>Existing records</h4>
					{!apiKey ? <p>Enter the API key above to manage timelines.</p> : null}
					{loadingTimelines ? <p aria-live="polite">Loading timelines…</p> : null}
					{timelineError ? <p role="alert">{timelineError}</p> : null}
					{apiKey && !loadingTimelines && !timelineError && timelines.length === 0 ? (
						<p>No timelines have been published.</p>
					) : null}
					{apiKey && timelines.length > 0 ? (
						<ul>
							{timelines.map((timeline) => (
								<li key={timeline.timelineId}>
									<div>
										<strong>{timeline.name}</strong>
										<span>
											{displayName(timeline.site)} · {timeline.contentCount} items ·{" "}
											{dateTimeLabel(timeline.createdAt)}
										</span>
									</div>
									<div className="timeline-record__actions">
										<ButtonLink
											aria-label={`View ${timeline.name} public timeline (opens in new tab)`}
											href={savedTimelinePath(timeline.site, timeline.slug)}
											rel="noreferrer"
											target="_blank"
											variant="text"
										>
											View
										</ButtonLink>
										<Button
											aria-label={`Edit ${timeline.name}`}
											onClick={() => editTimeline(timeline)}
											variant="quiet"
										>
											Edit
										</Button>
										<Button
											aria-label={`Delete ${timeline.name}`}
											onClick={() => void removeTimeline(timeline)}
											variant="danger"
										>
											Delete
										</Button>
									</div>
								</li>
							))}
						</ul>
					) : null}
				</div>
			</div>
		</section>
	);
}
