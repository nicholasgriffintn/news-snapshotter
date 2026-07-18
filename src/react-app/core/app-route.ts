export type AppPage = "admin" | "archive" | "history" | "privacy" | "terms";

export function resolveAppPage(path: string): AppPage {
	if (path === "/admin" || path.startsWith("/admin/")) {
		return "admin";
	}
	if (path === "/history" || path.startsWith("/history/")) {
		return "history";
	}
	if (path === "/privacy" || path.startsWith("/privacy/")) {
		return "privacy";
	}
	if (path === "/terms" || path.startsWith("/terms/")) {
		return "terms";
	}
	return "archive";
}
