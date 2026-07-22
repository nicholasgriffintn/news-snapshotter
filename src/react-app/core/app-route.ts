export type AppPage =
	| "admin"
	| "archive"
	| "compare"
	| "history"
	| "not-found"
	| "privacy"
	| "terms";

export function resolveAppPage(path: string): AppPage {
	if (path === "/admin" || path.startsWith("/admin/")) {
		return "admin";
	}
	if (path === "/history" || path.startsWith("/history/")) {
		return "history";
	}
	if (path === "/compare" || path.startsWith("/compare/")) {
		return "compare";
	}
	if (path === "/privacy") {
		return "privacy";
	}
	if (path === "/terms") {
		return "terms";
	}
	return path === "/" ? "archive" : "not-found";
}
