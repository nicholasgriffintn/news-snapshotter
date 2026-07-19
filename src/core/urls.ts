export function isWebUrl(value: unknown): value is string {
	if (typeof value !== "string") {
		return false;
	}

	try {
		const url = new URL(value);
		return url.protocol === "https:" || url.protocol === "http:";
	} catch {
		return false;
	}
}

export function urlsMatchIgnoringHash(requestedUrl: string, loadedUrl: string): boolean {
	try {
		const requested = new URL(requestedUrl);
		const loaded = new URL(loadedUrl);

		requested.hash = "";
		loaded.hash = "";

		return requested.href === loaded.href;
	} catch {
		return false;
	}
}
