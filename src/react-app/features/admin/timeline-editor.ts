export function defaultTimelineSite(sites: string[], initialSite: string): string {
	return initialSite && sites.includes(initialSite) ? initialSite : (sites[0] ?? "");
}

export function addTimelineElement(current: string[], elementKey: string): string[] {
	if (current.includes(elementKey) || current.length >= 10) {
		return current;
	}
	return [...current, elementKey];
}

export function removeTimelineElement(current: string[], elementKey: string): string[] {
	return current.filter((key) => key !== elementKey);
}
