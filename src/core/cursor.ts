export function encodeCursor(value: Record<string, string>): string {
	const bytes = new TextEncoder().encode(JSON.stringify(value));
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function decodeCursor(value: string): Record<string, string> {
	if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 2_048) {
		throw new Error("cursor is invalid");
	}
	try {
		const padded = value
			.replaceAll("-", "+")
			.replaceAll("_", "/")
			.padEnd(Math.ceil(value.length / 4) * 4, "=");
		const binary = atob(padded);
		const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
		const decoded: unknown = JSON.parse(new TextDecoder().decode(bytes));
		if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error();
		const entries = Object.entries(decoded);
		if (!entries.every(([, entry]) => typeof entry === "string")) throw new Error();
		return Object.fromEntries(entries);
	} catch {
		throw new Error("cursor is invalid");
	}
}
