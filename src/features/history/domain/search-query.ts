import { InvalidInputError } from "../../../core/errors.ts";

export function historySearchQuery(value: string): string {
	const terms = value
		.normalize("NFKC")
		.toLocaleLowerCase("en-GB")
		.match(/[\p{L}\p{N}]+/gu)
		?.slice(0, 8);
	if (!terms || terms.length === 0) {
		throw new InvalidInputError("q must contain searchable text");
	}
	return terms.map((term) => `"${term}"*`).join(" AND ");
}
