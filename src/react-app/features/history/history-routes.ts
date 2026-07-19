export function contentHistoryPath(site: string, elementKey: string): string {
	const search = new URLSearchParams({ element: elementKey });
	return `/history/${encodeURIComponent(site)}/content?${search}`;
}

export function contentKeyFromSearch(search: string): string | undefined {
	return new URLSearchParams(search).get("element") ?? undefined;
}
