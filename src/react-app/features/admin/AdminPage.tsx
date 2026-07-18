import { useState } from "react";

import { AdminAccessPanel } from "./AdminAccessPanel.tsx";
import { AdminNavigation } from "./AdminNavigation.tsx";
import { BotCheckTool } from "./BotCheckTool";
import { CaptureTool } from "./CaptureTool";
import { ADMIN_TOOL_DETAILS, DEFAULT_ADMIN_TOOL, type AdminToolId } from "./admin-tools.ts";
import { FailureLog } from "./FailureLog";
import { HistoryOperationsTool } from "./HistoryOperationsTool.tsx";
import { ExtractorPreviewTool } from "./ExtractorPreviewTool.tsx";
import { useAdminConfiguration } from "./useAdminConfiguration.ts";

export function AdminPage() {
	const [apiKey, setApiKey] = useState("");
	const [activeTool, setActiveTool] = useState<AdminToolId>(DEFAULT_ADMIN_TOOL);
	const configuration = useAdminConfiguration();
	const activeToolDetails = ADMIN_TOOL_DETAILS[activeTool];

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
				<AdminNavigation activeTool={activeTool} onChange={setActiveTool} />
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
					<div className="admin-workspace__body">
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
						{activeTool === "failures" ? <FailureLog apiKey={apiKey} /> : null}
						{activeTool === "history" ? <HistoryOperationsTool apiKey={apiKey} /> : null}
						{activeTool === "extractors" ? <ExtractorPreviewTool apiKey={apiKey} /> : null}
					</div>
				</section>
			</div>
		</section>
	);
}
