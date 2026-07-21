export function parseJson(value: string): unknown {
	try {
		return JSON.parse(value);
	} catch {
		return undefined;
	}
}

export function jsonRecord(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === "object" && !Array.isArray(value)
		? Object.fromEntries(Object.entries(value))
		: undefined;
}

export function hasOnlyKeys(
	record: Record<string, unknown>,
	allowedKeys: readonly string[],
): boolean {
	const allowed = new Set(allowedKeys);
	return Object.keys(record).every((key) => allowed.has(key));
}

export function parseJsonRecord(value: string): Record<string, unknown> {
	return jsonRecord(parseJson(value)) ?? {};
}

export function parseJsonStringArray(value: string): string[] {
	const parsed = parseJson(value);
	return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
}
