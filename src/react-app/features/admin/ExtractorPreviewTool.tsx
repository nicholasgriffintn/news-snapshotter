import { useEffect, useState } from "react";

import {
	downloadExtractorFixture,
	fetchExtractorChecklist,
	fetchExtractorPreview,
	type ExtractorPreview,
} from "../../platform/api-client.ts";

export function ExtractorPreviewTool({ apiKey }: { apiKey: string }) {
	const [checklist, setChecklist] = useState<string[]>([]);
	const [key, setKey] = useState("");
	const [preview, setPreview] = useState<ExtractorPreview>();
	const [status, setStatus] = useState("");

	useEffect(() => {
		if (!apiKey) return;
		fetchExtractorChecklist(apiKey)
			.then(setChecklist)
			.catch(() => setChecklist([]));
	}, [apiKey]);

	async function loadPreview(): Promise<void> {
		if (!apiKey || !key.trim()) return;
		setStatus("Loading private extraction artefact…");
		try {
			const result = await fetchExtractorPreview(apiKey, key.trim());
			setPreview(result);
			setStatus("");
		} catch (reason) {
			setPreview(undefined);
			setStatus(reason instanceof Error ? reason.message : "Could not load extractor preview.");
		}
	}

	return (
		<section className="admin-tool extractor-preview-tool">
			<header className="admin-tool__header">
				<p className="eyebrow">Private archive inspection</p>
				<h2>Extractor preview</h2>
				<p>
					Run a live capture in the capture tab, then inspect its stored extraction here. Archived
					HTML remains private and is never executed.
				</p>
			</header>
			<div className="extractor-key-form">
				<label>
					<span>Extraction R2 key</span>
					<input
						onChange={(event) => setKey(event.target.value)}
						placeholder="brand=…/capture.extraction.v1.json.gz"
						value={key}
					/>
				</label>
				<button
					className="impact-button"
					disabled={!apiKey || !key.trim()}
					onClick={() => void loadPreview()}
					type="button"
				>
					Preview extraction
				</button>
			</div>
			<p aria-live="polite" className="admin-status">
				{!apiKey ? "Enter the API key above to inspect private extraction artefacts." : status}
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
									<tr key={element.elementKey}>
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
			{checklist.length > 0 ? (
				<details>
					<summary>Extractor authoring checklist</summary>
					<ul>
						{checklist.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</details>
			) : null}
		</section>
	);
}
