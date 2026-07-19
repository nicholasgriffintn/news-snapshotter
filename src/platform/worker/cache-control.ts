const PUBLIC_DATA_PATHS = new Set(["/api/history/sites/available", "/api/screenshots"]);
const STATIC_DATA_PATHS = new Set([
	"/api/capture-profiles",
	"/api/capture-providers",
	"/api/catalogue",
]);

const PUBLIC_DATA_BROWSER_POLICY = "public, max-age=60";
const PUBLIC_DATA_EDGE_POLICY = "max-age=300, stale-while-revalidate=3600";
const STATIC_DATA_BROWSER_POLICY = "public, max-age=3600";
const STATIC_DATA_EDGE_POLICY = "max-age=86400, stale-while-revalidate=604800";

function responseWithHeaders(response: Response, headers: Headers): Response {
	return new Response(response.body, {
		headers,
		status: response.status,
		statusText: response.statusText,
	});
}

export function applyApiCachePolicy(
	request: Request,
	response: Response,
	authorised: boolean,
): Response {
	if (response.status === 401 || authorised) {
		const headers = new Headers(response.headers);
		headers.set("cache-control", "private, no-store");
		return responseWithHeaders(response, headers);
	}

	if (request.method !== "GET" || response.status < 200 || response.status >= 300) {
		return response;
	}

	const pathname = new URL(request.url).pathname;
	const browserPolicy = PUBLIC_DATA_PATHS.has(pathname)
		? PUBLIC_DATA_BROWSER_POLICY
		: STATIC_DATA_PATHS.has(pathname)
			? STATIC_DATA_BROWSER_POLICY
			: undefined;
	if (!browserPolicy) {
		return response;
	}

	const headers = new Headers(response.headers);
	headers.set("cache-control", browserPolicy);
	headers.set(
		"cloudflare-cdn-cache-control",
		PUBLIC_DATA_PATHS.has(pathname) ? PUBLIC_DATA_EDGE_POLICY : STATIC_DATA_EDGE_POLICY,
	);
	return responseWithHeaders(response, headers);
}
