export function defaultTimelineSite(sites: string[], initialSite: string): string {
	return initialSite && sites.includes(initialSite) ? initialSite : (sites[0] ?? "");
}

export type RequestToken = AbortController;

export function createRequestGate(): {
	cancel: () => void;
	isCurrent: (token: RequestToken) => boolean;
	start: () => RequestToken;
} {
	let current: RequestToken | undefined;
	return {
		cancel: () => {
			current?.abort();
			current = undefined;
		},
		isCurrent: (token) => current === token && !token.signal.aborted,
		start: () => {
			current?.abort();
			current = new AbortController();
			return current;
		},
	};
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
