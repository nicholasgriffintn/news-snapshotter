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
