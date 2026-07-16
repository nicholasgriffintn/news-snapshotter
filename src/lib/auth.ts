const encoder = new TextEncoder();

export function isAuthorised(authorization: string | null, apiKey: string): boolean {
	if (!authorization?.startsWith('Bearer ') || !apiKey) return false;

	const supplied = encoder.encode(authorization.slice('Bearer '.length));
	const expected = encoder.encode(apiKey);
	let difference = supplied.length ^ expected.length;
	const length = Math.max(supplied.length, expected.length);

	for (let index = 0; index < length; index += 1) {
		difference |= (supplied[index] ?? 0) ^ (expected[index] ?? 0);
	}

	return difference === 0;
}
