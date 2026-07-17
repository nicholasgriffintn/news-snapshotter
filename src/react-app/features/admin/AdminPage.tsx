import { useEffect, useState } from "react";

import {
	fetchCaptureProfiles,
	fetchCaptureProviders,
	fetchCatalogue,
} from "../../platform/api-client.ts";
import type {
	CaptureProviderName,
	CatalogueSite,
} from "../../core/types.ts";
import { BotCheckTool } from "./BotCheckTool";
import { CaptureTool } from "./CaptureTool";
import { FailureLog } from "./FailureLog";

type AdminView = "capture" | "diagnostics" | "failures";

const VIEWS: Array<{ label: string; value: AdminView }> = [
	{ label: "Run captures", value: "capture" },
	{ label: "Browser diagnostic", value: "diagnostics" },
	{ label: "Failure log", value: "failures" },
];

export function AdminPage() {
	const [apiKeyDraft, setApiKeyDraft] = useState("");
	const [apiKey, setApiKey] = useState("");
	const [catalogue, setCatalogue] = useState<CatalogueSite[]>([]);
	const [profiles, setProfiles] = useState<string[]>([]);
	const [providers, setProviders] = useState<CaptureProviderName[]>([]);
	const [view, setView] = useState<AdminView>("capture");
	const [setupStatus, setSetupStatus] = useState("Loading capture configuration…");

	useEffect(() => {
		Promise.all([
			fetchCatalogue(),
			fetchCaptureProfiles(),
			fetchCaptureProviders(),
		])
			.then(([sites, captureProfiles, captureProviders]) => {
				setCatalogue(sites);
				setProfiles(captureProfiles);
				setProviders(captureProviders);
				setSetupStatus("");
			})
			.catch(() => setSetupStatus("Could not load the capture configuration."));
	}, []);

	return (
		<section className="admin-panel">
			<div className="admin-credentials">
				<form
					className="admin-key-form"
					onSubmit={(event) => {
						event.preventDefault();
						setApiKey(apiKeyDraft.trim());
					}}
				>
					<label className="admin-key">
						<span>API key</span>
						<input
							autoComplete="off"
							onChange={(event) => setApiKeyDraft(event.target.value)}
							placeholder="Enter API key"
							type="password"
							value={apiKeyDraft}
						/>
					</label>
					<button className="admin-secondary-button" type="submit">
						{apiKey ? "Update key" : "Enable actions"}
					</button>
					<small>
						{apiKey
							? "Admin actions enabled for this session."
							: "Required for every admin action."}
					</small>
				</form>
			</div>

			<nav aria-label="Admin tools" className="admin-tabs">
				{VIEWS.map((item) => (
					<button
						aria-current={view === item.value ? "page" : undefined}
						key={item.value}
						onClick={() => setView(item.value)}
						type="button"
					>
						{item.label}
					</button>
				))}
			</nav>

			{setupStatus ? (
				<p aria-live="polite" className="admin-status">
					{setupStatus}
				</p>
			) : null}
			<div className="admin-workspace">
				{view === "capture" ? (
					<CaptureTool
						apiKey={apiKey}
						catalogue={catalogue}
						providers={providers}
					/>
				) : null}
				{view === "diagnostics" ? <BotCheckTool apiKey={apiKey} profiles={profiles} /> : null}
				{view === "failures" ? <FailureLog apiKey={apiKey} /> : null}
			</div>
		</section>
	);
}
