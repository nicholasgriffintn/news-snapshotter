export function contentHistoryPath(site: string, elementKey: string): string {
	const search = new URLSearchParams({ element: elementKey });
	return `/history/${encodeURIComponent(site)}/content?${search}`;
}

export function contentComparisonPath(site: string, elementKeys: Iterable<string>): string {
	const search = new URLSearchParams();
	for (const elementKey of elementKeys) {
		search.append("element", elementKey);
	}
	return `/history/${encodeURIComponent(site)}/compare?${search}`;
}

export function contentKeyFromSearch(search: string): string | undefined {
	return new URLSearchParams(search).get("element") ?? undefined;
}

export function publisherResearchPath(site: string): string {
	return `/history/${encodeURIComponent(site)}/research#comparison`;
}
