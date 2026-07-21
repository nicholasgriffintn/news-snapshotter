export class InvalidInputError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "InvalidInputError";
	}
}

export class PayloadTooLargeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PayloadTooLargeError";
	}
}

export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Unknown error";
}
