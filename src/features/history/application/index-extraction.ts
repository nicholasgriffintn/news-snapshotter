import { errorMessage } from "../../../core/errors.ts";
import { parsePageExtraction } from "../domain/extraction.ts";
import { ingestExtraction } from "../infrastructure/history-repository.ts";

export type HistoryIndexMessage = {
	captureId: string;
	extractionKey: string;
	site: string;
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
): Promise<string> {
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
	return chunks.join("");
}

async function readExtraction(bucket: R2Bucket, key: string): Promise<unknown> {
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
		return JSON.parse(serialised);
	} catch {
		throw new Error(`Extraction artefact is not valid JSON: ${key}`);
	}
}

async function recordIndexingFailure(
	database: D1Database,
	message: HistoryIndexMessage,
	error: unknown,
): Promise<void> {
	await database
		.prepare(
			`INSERT INTO extraction_failures (
				capture_id, site, device, extraction_key, stage, message, failed_at
			) VALUES (?, ?, 'desktop', ?, 'indexing', ?, ?)`,
		)
		.bind(
			message.captureId.slice(0, 4_096),
			message.site.slice(0, 4_096),
			message.extractionKey.slice(0, 4_096),
			errorMessage(error).slice(0, 20_000),
			new Date().toISOString(),
		)
		.run();
}

export async function indexExtractionArtefact(
	env: HistoryIndexEnv,
	message: HistoryIndexMessage,
): Promise<{ changeCount: number }> {
	try {
		if (
			!message.captureId ||
			message.captureId.length > 4_096 ||
			!message.site ||
			message.site.length > 4_096 ||
			!message.extractionKey.endsWith(".json.gz") ||
			message.extractionKey.length > 4_096
		) {
			throw new Error("Queue message is invalid");
		}
		const rawDocument = await readExtraction(env.ARCHIVE_DATA, message.extractionKey);
		const document = parsePageExtraction(rawDocument);
		if (
			document.capture.captureId !== message.captureId ||
			document.capture.site !== message.site
		) {
			throw new Error("Queue message does not match extraction capture identity");
		}

		return await ingestExtraction(env.HISTORY_DB, message.extractionKey, document);
	} catch (error) {
		try {
			await recordIndexingFailure(env.HISTORY_DB, message, error);
		} catch (failureError) {
			console.error("Could not record extraction indexing failure", {
				captureId: message.captureId,
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
				captureId: message.body.captureId,
				error: errorMessage(error),
			});
			message.retry();
		}
	}
}
