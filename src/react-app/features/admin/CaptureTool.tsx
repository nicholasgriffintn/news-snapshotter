import { useEffect, useMemo, useState } from "react";

import { startSnapshotWorkflow } from "../../platform/api-client.ts";
import { displayName } from "../../shared/format.ts";
import type { CapturePriority, CaptureProviderName, CatalogueSite } from "../../core/types.ts";

type Scope = "priority" | "brand" | "site";

const CAPTURE_PRIORITIES: CapturePriority[] = [1, 2, 3, 4];

const PRIORITY_LABELS: Record<CapturePriority, string> = {
	1: "Publisher home pages",
	2: "Major news and sport sections",
	3: "Specialist categories and topics",
	4: "Local and regional pages",
};

type CaptureToolProps = {
	apiKey: string;
	catalogue: CatalogueSite[];
	providers: CaptureProviderName[];
};

export function CaptureTool({ apiKey, catalogue, providers }: CaptureToolProps) {
	const [scope, setScope] = useState<Scope>("priority");
	const [brand, setBrand] = useState("");
	const [name, setName] = useState("");
	const [priority, setPriority] = useState<CapturePriority>(1);
	const [provider, setProvider] = useState<"profile" | CaptureProviderName>("profile");
	const [status, setStatus] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const brands = useMemo(
		() => [...new Set(catalogue.map((site) => site.brand))].sort(),
		[catalogue],
	);

	useEffect(() => {
		if (!brands.includes(brand)) {
			setBrand(brands[0] ?? "");
		}
		if (!catalogue.some((site) => site.name === name)) {
			setName(catalogue[0]?.name ?? "");
		}
	}, [brand, brands, catalogue, name]);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		setSubmitting(true);
		setStatus("Starting capture workflow…");

		try {
			let selection: {
				brand?: string;
				name?: string;
				priority?: CapturePriority;
				provider?: CaptureProviderName;
			};

			if (scope === "brand") {
				selection = { brand };
			} else if (scope === "site") {
				selection = { name };
			} else {
				selection = { priority };
			}

			if (provider !== "profile") {
				selection.provider = provider;
			}

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
					{(["priority", "brand", "site"] as Scope[]).map((value) => (
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

			{scope === "priority" ? (
				<label>
					<span>Capture priority</span>
					<select
						onChange={(event) => {
							setPriority(Number(event.target.value) as CapturePriority);
						}}
						value={priority}
					>
						{CAPTURE_PRIORITIES.map((value) => (
							<option key={value} value={value}>
								Priority {value} · {PRIORITY_LABELS[value]}
							</option>
						))}
					</select>
				</label>
			) : null}

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

			<label>
				<span>Browser provider</span>
				<select
					onChange={(event) => {
						setProvider(event.target.value as "profile" | CaptureProviderName);
					}}
					value={provider}
				>
					<option value="profile">Profile default</option>
					{providers.map((value) => (
						<option key={value} value={value}>
							{displayName(value)}
						</option>
					))}
				</select>
			</label>

			<button className="impact-button" disabled={!apiKey || submitting} type="submit">
				{submitting ? "Starting…" : "Start capture"}
			</button>
			<p aria-live="polite" className="admin-status">
				{!apiKey && !status ? "Enter the API key above to enable capture actions." : status}
			</p>
		</form>
	);
}
