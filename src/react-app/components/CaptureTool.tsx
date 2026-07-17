import { useEffect, useMemo, useState } from "react";

import { startSnapshotWorkflow } from "../lib/api";
import { displayName } from "../lib/format";
import type { CatalogueSite } from "../types";

type Scope = "all" | "brand" | "site";

export function CaptureTool({ apiKey, catalogue }: { apiKey: string; catalogue: CatalogueSite[] }) {
	const [scope, setScope] = useState<Scope>("all");
	const [brand, setBrand] = useState("");
	const [name, setName] = useState("");
	const [status, setStatus] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const brands = useMemo(
		() => [...new Set(catalogue.map((site) => site.brand))].sort(),
		[catalogue],
	);

	useEffect(() => {
		if (!brands.includes(brand)) setBrand(brands[0] ?? "");
		if (!catalogue.some((site) => site.name === name)) setName(catalogue[0]?.name ?? "");
	}, [brand, brands, catalogue, name]);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		setSubmitting(true);
		setStatus("Starting capture workflow…");

		try {
			const selection = scope === "brand" ? { brand } : scope === "site" ? { name } : {};
			const result = await startSnapshotWorkflow(apiKey, selection);
			const sitePlural = result.selectedSites.length === 1 ? "" : "s";
			const runnerPlural = result.runnerCount === 1 ? "" : "s";
			setStatus(
				`${result.batchId} started ${result.selectedSites.length} site${sitePlural} ` +
					`across ${result.runnerCount} runner${runnerPlural}.`,
			);
		} catch (reason) {
			setStatus(reason instanceof Error ? reason.message : "Could not start workflow.");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<form className="admin-tool" onSubmit={submit}>
			<header className="admin-tool__header">
				<h2>Run captures</h2>
			</header>

			<fieldset>
				<legend>Capture scope</legend>
				<div className="scope-picker">
					{(["all", "brand", "site"] as Scope[]).map((value) => (
						<label key={value}>
							<input
								checked={scope === value}
								name="scope"
								onChange={() => setScope(value)}
								type="radio"
							/>
							<span>{displayName(value)}</span>
						</label>
					))}
				</div>
			</fieldset>

			{scope === "brand" ? (
				<label>
					<span>Publisher</span>
					<select onChange={(event) => setBrand(event.target.value)} value={brand}>
						{brands.map((value) => (
							<option key={value} value={value}>
								{displayName(value)}
							</option>
						))}
					</select>
				</label>
			) : null}

			{scope === "site" ? (
				<label>
					<span>Site</span>
					<select onChange={(event) => setName(event.target.value)} value={name}>
						{catalogue.map((site) => (
							<option key={site.name} value={site.name}>
								{displayName(site.name)} · {site.category}
							</option>
						))}
					</select>
				</label>
			) : null}

			<button className="impact-button" disabled={!apiKey || submitting} type="submit">
				{submitting ? "Starting…" : "Start capture"}
			</button>
			<p aria-live="polite" className="admin-status">
				{!apiKey && !status ? "Enter the API key above to enable capture actions." : status}
			</p>
		</form>
	);
}
