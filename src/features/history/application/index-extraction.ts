import { errorMessage } from "../../../core/errors.ts";
import { parsePageExtraction } from "../domain/extraction.ts";
import { ingestExtraction } from "../infrastructure/history-repository.ts";

export type HistoryIndexMessage =
	| {
			captureId?: string;
			extractionKey: string;
			kind: "extraction";
			site?: string;
	  }
	| {
			failureKey: string;
			kind: "failure";
	  };

type HistoryIndexEnv = {
	ARCHIVE_DATA: R2Bucket;
	HISTORY_DB: D1Database;
};

const MAX_COMPRESSED_EXTRACTION_BYTES = 5 * 1_024 * 1_024;
const MAX_EXTRACTION_BYTES = 10 * 1_024 * 1_024;

async function readBoundedText(
	stream: ReadableStream<Uint8Array>,
	maximumBytes: number,
): Promise<{ bytes: number; text: string }> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	const chunks: string[] = [];
	let bytes = 0;

	while (true) {
		const result = await reader.read();
		if (result.done) break;
		bytes += result.value.byteLength;
		if (bytes > maximumBytes) {
			await reader.cancel();
			throw new Error("Extraction artefact exceeds the decompressed size limit");
		}
		chunks.push(decoder.decode(result.value, { stream: true }));
	}
	chunks.push(decoder.decode());
	return { bytes, text: chunks.join("") };
}

async function readArchiveJson(
	bucket: R2Bucket,
	key: string,
): Promise<{ compressedBytes: number; decompressedBytes: number; value: unknown }> {
	const object = await bucket.get(key);
	if (!object) throw new Error(`Extraction artefact not found: ${key}`);
	if (object.size > MAX_COMPRESSED_EXTRACTION_BYTES) {
		throw new Error("Extraction artefact exceeds the compressed size limit");
	}

	const stream = key.endsWith(".gz")
		? object.body.pipeThrough(new DecompressionStream("gzip"))
		: object.body;
	const serialised = await readBoundedText(stream, MAX_EXTRACTION_BYTES);

	try {
		return {
			compressedBytes: object.size,
			decompressedBytes: serialised.bytes,
			value: JSON.parse(serialised.text),
		};
	} catch {
		throw new Error(`Extraction artefact is not valid JSON: ${key}`);
	}
}

async function recordIndexingFailure(
	database: D1Database,
	message: HistoryIndexMessage,
	error: unknown,
): Promise<void> {
	const artefactKey = message.kind === "extraction" ? message.extractionKey : message.failureKey;
	const captureId = message.kind === "extraction" ? message.captureId : undefined;
	const site = message.kind === "extraction" ? message.site : undefined;
	await database
		.prepare(
			`INSERT INTO extraction_failures (
				failure_key, capture_id, site, device, extraction_key, stage, message, failed_at
			) VALUES (?, ?, ?, 'desktop', ?, 'indexing', ?, ?)
			ON CONFLICT(failure_key) DO UPDATE SET
				message = excluded.message,
				failed_at = excluded.failed_at`,
		)
		.bind(
			`indexing:${artefactKey}`.slice(0, 4_096),
			captureId?.slice(0, 4_096) ?? null,
			site?.slice(0, 4_096) ?? null,
			artefactKey.slice(0, 4_096),
			errorMessage(error).slice(0, 20_000),
			new Date().toISOString(),
		)
		.run();
}

type AnalysisFailure = {
	captureId: string;
	capturedAt: string;
	device: "desktop";
	message: string;
	site: string;
	triggeredAt: string;
};

function parseAnalysisFailure(value: unknown): AnalysisFailure {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Analysis failure artefact must be an object");
	}
	const failure = value as Record<string, unknown>;
	const strings = ["captureId", "capturedAt", "message", "site", "triggeredAt"];
	if (
		failure.device !== "desktop" ||
		!strings.every((key) => {
			return typeof failure[key] === "string" && failure[key].length > 0;
		}) ||
		String(failure.message).length > 20_000
	) {
		throw new Error("Analysis failure artefact does not match the supported schema");
	}
	return value as AnalysisFailure;
}

async function indexAnalysisFailure(
	database: D1Database,
	failureKey: string,
	failure: AnalysisFailure,
): Promise<void> {
	await database
		.prepare(
			`INSERT INTO extraction_failures (
				failure_key, capture_id, site, device, extraction_key, stage, message, failed_at
			) VALUES (?, ?, ?, ?, ?, 'validation', ?, ?)
			ON CONFLICT(failure_key) DO UPDATE SET
				message = excluded.message,
				failed_at = excluded.failed_at`,
		)
		.bind(
			failureKey,
			failure.captureId,
			failure.site,
			failure.device,
			failureKey,
			failure.message,
			failure.capturedAt,
		)
		.run();
}

export async function indexExtractionArtefact(
	env: HistoryIndexEnv,
	message: HistoryIndexMessage,
): Promise<{ changeCount: number }> {
	try {
		const artefactKey = message.kind === "extraction" ? message.extractionKey : message.failureKey;
		if (!artefactKey || artefactKey.length > 4_096) {
			throw new Error("Queue message is invalid");
		}
		if (message.kind === "failure") {
			if (!message.failureKey.endsWith(".analysis-failure.json")) {
				throw new Error("Queue message is invalid");
			}
			const rawFailure = await readArchiveJson(env.ARCHIVE_DATA, message.failureKey);
			await indexAnalysisFailure(
				env.HISTORY_DB,
				message.failureKey,
				parseAnalysisFailure(rawFailure.value),
			);
			return { changeCount: 0 };
		}
		if (!message.extractionKey.endsWith(".json.gz")) {
			throw new Error("Queue message is invalid");
		}
		const rawDocument = await readArchiveJson(env.ARCHIVE_DATA, message.extractionKey);
		const document = parsePageExtraction(rawDocument.value);
		if (
			(message.captureId && document.capture.captureId !== message.captureId) ||
			(message.site && document.capture.site !== message.site)
		) {
			throw new Error("Queue message does not match extraction capture identity");
		}

		return await ingestExtraction(env.HISTORY_DB, message.extractionKey, document, {
			compressedBytes: rawDocument.compressedBytes,
			decompressedBytes: rawDocument.decompressedBytes,
		});
	} catch (error) {
		try {
			await recordIndexingFailure(env.HISTORY_DB, message, error);
		} catch (failureError) {
			console.error("Could not record extraction indexing failure", {
				artefactKey: message.kind === "extraction" ? message.extractionKey : message.failureKey,
				error: errorMessage(failureError),
			});
		}
		throw error;
	}
}

export async function handleHistoryIndexQueue(
	batch: MessageBatch<HistoryIndexMessage>,
	env: HistoryIndexEnv,
): Promise<void> {
	for (const message of batch.messages) {
		try {
			await indexExtractionArtefact(env, message.body);
			message.ack();
		} catch (error) {
			console.error("History extraction indexing failed", {
				artefactKey:
					message.body.kind === "extraction" ? message.body.extractionKey : message.body.failureKey,
				error: errorMessage(error),
			});
			message.retry();
		}
	}
}
