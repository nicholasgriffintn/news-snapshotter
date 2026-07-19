export class InvalidInputError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "InvalidInputError";
	}
}

export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Unknown error";
}
