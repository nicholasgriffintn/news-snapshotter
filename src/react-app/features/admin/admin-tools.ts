export type AdminToolId =
	| "capture"
	| "comparison"
	| "diagnostics"
	| "failures"
	| "history"
	| "extractors";

type AdminToolDetails = {
	description: string;
	label: string;
};

export const DEFAULT_ADMIN_TOOL: AdminToolId = "capture";

export const ADMIN_TOOL_DETAILS: Record<AdminToolId, AdminToolDetails> = {
	capture: {
		description: "Start a capture batch by priority, publisher or individual site.",
		label: "Run captures",
	},
	comparison: {
		description: "Review processing, handle submitted reports and backfill comparison analysis.",
		label: "Comparison operations",
	},
	diagnostics: {
		description: "Test capture profiles against bot detection before a live run.",
		label: "Browser diagnostic",
	},
	failures: {
		description: "Review capture and extraction errors and identify recurring publisher issues.",
		label: "Failure log",
	},
	history: {
		description: "Backfill the archive, publish timelines and materialise research data.",
		label: "History operations",
	},
	extractors: {
		description: "Inspect private extraction artefacts and prepare reviewed fixtures.",
		label: "Extractor preview",
	},
};

export const ADMIN_TOOL_GROUPS: Array<{ label: string; tools: AdminToolId[] }> = [
	{ label: "Capture", tools: ["capture"] },
	{ label: "Comparison", tools: ["comparison"] },
	{ label: "Diagnostics", tools: ["diagnostics", "failures"] },
	{ label: "Data tools", tools: ["history", "extractors"] },
];

export function adminStateFromSearch(search: string): { site: string; tool: AdminToolId } {
	const parameters = new URLSearchParams(search);
	const requestedTool = parameters.get("tool");
	const tool =
		requestedTool && requestedTool in ADMIN_TOOL_DETAILS
			? (requestedTool as AdminToolId)
			: DEFAULT_ADMIN_TOOL;

	return {
		site: (parameters.get("site") ?? "").slice(0, 200),
		tool,
	};
}
