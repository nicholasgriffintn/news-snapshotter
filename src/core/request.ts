import { PayloadTooLargeError } from "./errors.ts";

export async function readBoundedJson(request: Request, maximumBytes: number): Promise<unknown> {
	const declaredLength = Number(request.headers.get("content-length") ?? "0");
	if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
		throw new PayloadTooLargeError("Request body is too large");
	}
	if (!request.body) {
		return JSON.parse("");
	}
	const reader = request.body.getReader();
	const decoder = new TextDecoder();
	const parts: string[] = [];
	let bytes = 0;
	while (true) {
		const result = await reader.read();
		if (result.done) {
			break;
		}
		bytes += result.value.byteLength;
		if (bytes > maximumBytes) {
			await reader.cancel();
			throw new PayloadTooLargeError("Request body is too large");
		}
		parts.push(decoder.decode(result.value, { stream: true }));
	}
	parts.push(decoder.decode());
	return JSON.parse(parts.join(""));
}
