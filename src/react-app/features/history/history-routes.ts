export function storyHistoryPath(site: string, storyId: string): string {
	const search = new URLSearchParams({ story: storyId });
	return `/history/${encodeURIComponent(site)}/stories?${search}`;
}

export function storyIdFromSearch(search: string): string | undefined {
	return new URLSearchParams(search).get("story") ?? undefined;
}
