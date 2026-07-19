import { useEffect, useState } from "react";

import {
	downloadExtractorFixture,
	fetchExtractorPreview,
	fetchHistoryExtractions,
	type ExtractionSummary,
	type ExtractorPreview,
} from "../../platform/api-client.ts";
import { displayName } from "../../shared/format.ts";

export function ExtractorPreviewTool({ apiKey }: { apiKey: string }) {
	const [extractions, setExtractions] = useState<ExtractionSummary[]>([]);
	const [limit, setLimit] = useState(25);
	const [listStatus, setListStatus] = useState("");
	const [loadingKey, setLoadingKey] = useState("");
	const [preview, setPreview] = useState<ExtractorPreview>();
	const [selectedKey, setSelectedKey] = useState("");
	const [site, setSite] = useState("");
	const [sort, setSort] = useState<"newest" | "oldest">("newest");
	const [status, setStatus] = useState("");

	useEffect(() => {
		if (!apiKey) {
			return;
		}
		setListStatus("Loading extractions…");
		fetchHistoryExtractions(apiKey, { limit: 25, sort: "newest" })
			.then((results) => {
				setExtractions(results);
				setListStatus("");
			})
			.catch((reason: unknown) => {
				setExtractions([]);
				setListStatus(reason instanceof Error ? reason.message : "Could not list extractions.");
			});
	}, [apiKey]);

	async function listExtractions(): Promise<void> {
		if (!apiKey) {
			return;
		}
		setListStatus("Loading extractions…");
		try {
			const results = await fetchHistoryExtractions(apiKey, {
				limit,
				site: site.trim() || undefined,
				sort,
			});
			setExtractions(results);
			setListStatus(results.length === 0 ? "No indexed extractions match these filters." : "");
		} catch (reason) {
			setExtractions([]);
			setListStatus(reason instanceof Error ? reason.message : "Could not list extractions.");
		}
	}

	async function loadPreview(key: string): Promise<void> {
		if (!apiKey) {
			return;
		}
		setSelectedKey(key);
		setLoadingKey(key);
		setStatus("Loading private extraction artefact…");
		try {
			const result = await fetchExtractorPreview(apiKey, key);
			setPreview(result);
			setStatus("");
		} catch (reason) {
			setPreview(undefined);
			setStatus(reason instanceof Error ? reason.message : "Could not load extractor preview.");
		} finally {
			setLoadingKey("");
		}
	}

	return (
		<section className="admin-tool extractor-preview-tool">
			<header className="admin-tool__header">
				<h3>Inspect an extraction</h3>
				<p>
					Select an indexed capture to inspect its extraction. Archived HTML remains private and is
					never executed.
				</p>
			</header>
			<form
				className="extractor-list-controls"
				onSubmit={(event) => {
					event.preventDefault();
					void listExtractions();
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
				<label>
					<span>Order</span>
					<select
						onChange={(event) => setSort(event.target.value === "oldest" ? "oldest" : "newest")}
						value={sort}
					>
						<option value="newest">Newest first</option>
						<option value="oldest">Oldest first</option>
					</select>
				</label>
				<label>
					<span>Limit</span>
					<select onChange={(event) => setLimit(Number(event.target.value))} value={limit}>
						<option value={10}>10</option>
						<option value={25}>25</option>
						<option value={50}>50</option>
						<option value={100}>100</option>
					</select>
				</label>
				<button className="impact-button" disabled={!apiKey} type="submit">
					Refresh list
				</button>
			</form>
			<p aria-live="polite" className="admin-status">
				{!apiKey ? "Enter the API key above to list private extractions." : listStatus}
			</p>
			{extractions.length > 0 ? (
				<ul className="extractor-list">
					{extractions.map((extraction) => (
						<li
							aria-current={selectedKey === extraction.extractionKey ? "true" : undefined}
							key={extraction.captureId}
						>
							<div>
								<strong>{displayName(extraction.site)}</strong>
								<time dateTime={extraction.capturedAt}>
									{new Date(extraction.capturedAt).toLocaleString("en-GB")}
								</time>
								<small>
									{extraction.device} · {extraction.extractorName} v{extraction.extractorVersion}
								</small>
							</div>
							<span>
								<strong>{extraction.matchedElements}</strong> elements
							</span>
							<button
								className="admin-secondary-button"
								onClick={() => void loadPreview(extraction.extractionKey)}
								type="button"
							>
								{loadingKey === extraction.extractionKey ? "Loading…" : "Preview"}
							</button>
						</li>
					))}
				</ul>
			) : null}
			<p aria-live="polite" className="admin-status">
				{status}
			</p>
			{preview ? (
				<>
					<div className="extractor-preview-summary">
						<span>
							<strong>{preview.matchedElements}</strong> matched elements
						</span>
						<span>
							<strong>{preview.expectedMinimum ?? "—"}</strong> expected minimum
						</span>
						<span>
							<strong>{preview.warnings.length}</strong> warnings
						</span>
						<span>
							<strong>v{preview.capture.extractor.version}</strong> {preview.capture.extractor.name}
						</span>
					</div>
					<button
						className="admin-secondary-button"
						onClick={() => void downloadExtractorFixture(apiKey, preview.extractionKey)}
						type="button"
					>
						Download reviewed fixture JSON
					</button>
					{preview.warnings.length > 0 ? (
						<ul className="extractor-warnings">
							{preview.warnings.map((warning) => (
								<li key={`${warning.code}:${warning.message}`}>
									<strong>{warning.code}</strong> {warning.message}
								</li>
							))}
						</ul>
					) : null}
					<div className="extractor-elements">
						<table>
							<thead>
								<tr>
									<th>Stable key</th>
									<th>Kind</th>
									<th>Headline</th>
									<th>Geometry</th>
								</tr>
							</thead>
							<tbody>
								{preview.elements.map((element) => (
									<tr key={element.placementKey ?? element.elementKey}>
										<td>{element.elementKey}</td>
										<td>{element.kind}</td>
										<td>{element.headline ?? "—"}</td>
										<td>
											{Math.round(element.position.left)},{Math.round(element.position.top)} ·{" "}
											{Math.round(element.position.width)}×{Math.round(element.position.height)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</>
			) : null}
		</section>
	);
}
