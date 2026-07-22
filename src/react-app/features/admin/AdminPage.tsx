import { useState } from "react";

import { AdminAccessPanel } from "./AdminAccessPanel.tsx";
import { AdminNavigation } from "./AdminNavigation.tsx";
import { BotCheckTool } from "./BotCheckTool";
import { CaptureTool } from "./CaptureTool";
import { ComparisonOperationsTool } from "./ComparisonOperationsTool.tsx";
import { ADMIN_TOOL_DETAILS, adminStateFromSearch, type AdminToolId } from "./admin-tools.ts";
import { FailureLog } from "./FailureLog";
import { ExtractorPreviewTool } from "./ExtractorPreviewTool.tsx";
import { HistoryFailureDiagnostics } from "./HistoryFailureDiagnostics.tsx";
import { HistoryOperationsTool } from "./HistoryOperationsTool.tsx";
import { useAdminConfiguration } from "./useAdminConfiguration.ts";

export function AdminPage() {
	const [initialState] = useState(() => adminStateFromSearch(window.location.search));
	const [apiKey, setApiKey] = useState("");
	const [activeTool, setActiveTool] = useState<AdminToolId>(initialState.tool);
	const configuration = useAdminConfiguration();
	const activeToolDetails = ADMIN_TOOL_DETAILS[activeTool];

	function selectTool(tool: AdminToolId): void {
		setActiveTool(tool);
		const url = new URL(window.location.href);
		url.searchParams.set("tool", tool);
		window.history.replaceState(null, "", url);
	}

	return (
		<section className="admin-panel">
			<header className="admin-console-header">
				<div className="admin-console-header__intro">
					<h1>
						Control the <em>press.</em>
					</h1>
					<p>Run capture workflows, investigate failures and maintain the research archive.</p>
				</div>
				<AdminAccessPanel apiKey={apiKey} onChange={setApiKey} />
			</header>

			<div className="admin-console-layout">
				<AdminNavigation activeTool={activeTool} onChange={selectTool} />
				<section
					aria-labelledby="admin-workspace-title"
					className="admin-workspace"
					id="admin-workspace-panel"
				>
					<header className="admin-workspace__header">
						<div>
							<h2 id="admin-workspace-title">{activeToolDetails.label}</h2>
							<p>{activeToolDetails.description}</p>
						</div>
					</header>
					<div className="admin-workspace__body" key={apiKey || "locked"}>
						{configuration.status === "error" &&
						(activeTool === "capture" || activeTool === "diagnostics") ? (
							<p className="admin-configuration-error" role="alert">
								Capture options could not be loaded. Refresh the page to try again.
							</p>
						) : null}
						{activeTool === "capture" ? (
							<CaptureTool
								apiKey={apiKey}
								catalogue={configuration.catalogue}
								providers={configuration.providers}
							/>
						) : null}
						{activeTool === "diagnostics" ? (
							<BotCheckTool apiKey={apiKey} profiles={configuration.profiles} />
						) : null}
						{activeTool === "failures" ? (
							<div className="failure-tools">
								<HistoryFailureDiagnostics apiKey={apiKey} initialSite={initialState.site} />
								<FailureLog apiKey={apiKey} initialSite={initialState.site} />
							</div>
						) : null}
						{activeTool === "history" ? (
							<HistoryOperationsTool apiKey={apiKey} initialSite={initialState.site} />
						) : null}
						{activeTool === "extractors" ? (
							<ExtractorPreviewTool apiKey={apiKey} initialSite={initialState.site} />
						) : null}
						{activeTool === "comparison" ? <ComparisonOperationsTool apiKey={apiKey} /> : null}
					</div>
				</section>
			</div>
		</section>
	);
}
