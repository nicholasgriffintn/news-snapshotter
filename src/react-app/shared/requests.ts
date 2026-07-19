type FetchRequest = (input: string | URL, init?: RequestInit) => Promise<Response>;

function requestDetails(input: string | URL, init?: RequestInit) {
	const headers = new Headers(init?.headers);
	const headerValues: Array<[string, string]> = [];
	headers.forEach((value, name) => headerValues.push([name, value]));

	return {
		headers,
		key: JSON.stringify([
			input.toString(),
			init?.cache,
			init?.credentials,
			headerValues,
			init?.mode,
			init?.redirect,
		]),
		method: (init?.method ?? "GET").toUpperCase(),
		signal: init?.signal,
	};
}

function abortReason(signal: AbortSignal): unknown {
	return signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}

function waitForCaller<T>(request: Promise<T>, signal?: AbortSignal | null): Promise<T> {
	if (!signal) {
		return request;
	}
	if (signal.aborted) {
		return Promise.reject(abortReason(signal));
	}

	return new Promise((resolve, reject) => {
		const abort = () => reject(abortReason(signal));
		signal.addEventListener("abort", abort, { once: true });
		void request.then(
			(value) => {
				signal.removeEventListener("abort", abort);
				resolve(value);
			},
			(error: unknown) => {
				signal.removeEventListener("abort", abort);
				reject(error);
			},
		);
	});
}

export function coalescePublicGetRequests(load: FetchRequest): FetchRequest {
	const inFlight = new Map<string, Promise<Response>>();

	return async (input, init) => {
		const { headers, key, method, signal } = requestDetails(input, init);
		if (method !== "GET" || headers.has("authorization")) {
			return load(input, init);
		}

		let request = inFlight.get(key);
		if (!request) {
			request = load(input, signal ? { ...init, signal: undefined } : init);
			inFlight.set(key, request);
			const clear = () => {
				if (inFlight.get(key) === request) {
					inFlight.delete(key);
				}
			};
			void request.then(clear, clear);
		}

		return (await waitForCaller(request, signal)).clone();
	};
}
