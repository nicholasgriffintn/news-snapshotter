import { contentCategory } from "../domain/content-classification.ts";
import { diffAdjacentCaptures, type ChangeEvent } from "../domain/changes.ts";
import { pageElementPlacementKey, type PageExtraction } from "../domain/extraction.ts";
import { loadCaptureExtraction } from "./history-capture-store.ts";

function imageId(site: string, sourceUrl: string): string {
	return `${site}:${sourceUrl}`;
}

function captureStatement(
	database: D1Database,
	extractionKey: string,
	document: PageExtraction,
): D1PreparedStatement {
	const capture = document.capture;
	return database
		.prepare(
			`INSERT INTO analysed_captures (
				capture_id, site, device, captured_at, triggered_at, source_url,
				screenshot_key, html_key, extraction_key, content_hash, structure_hash,
				page_width, page_height, extractor_name, extractor_version, schema_version,
				sanitisation_version, profile, warnings_json, status, indexed_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'indexed', ?)
			ON CONFLICT(capture_id) DO UPDATE SET
				extraction_key = excluded.extraction_key,
				content_hash = excluded.content_hash,
				structure_hash = excluded.structure_hash,
				page_width = excluded.page_width,
				page_height = excluded.page_height,
				extractor_name = excluded.extractor_name,
				extractor_version = excluded.extractor_version,
				schema_version = excluded.schema_version,
				warnings_json = excluded.warnings_json,
				status = 'indexed',
				indexed_at = excluded.indexed_at`,
		)
		.bind(
			capture.captureId,
			capture.site,
			capture.device,
			capture.capturedAt,
			capture.triggeredAt,
			capture.sourceUrl,
			capture.screenshotKey,
			capture.htmlKey,
			extractionKey,
			document.contentHash,
			document.structureHash,
			capture.pageWidth,
			capture.pageHeight,
			capture.extractor.name,
			capture.extractor.version,
			capture.schemaVersion,
			capture.sanitisationVersion,
			capture.profile,
			JSON.stringify(document.warnings),
			new Date().toISOString(),
		);
}

function contentStatements(database: D1Database, document: PageExtraction): D1PreparedStatement[] {
	const statements: D1PreparedStatement[] = [];
	for (const element of document.elements) {
		const sourceUrl = element.image?.sourceUrl;
		const currentImageId = sourceUrl ? imageId(document.capture.site, sourceUrl) : null;
		const category = contentCategory(element.canonicalUrl, element.category, element.section);

		if (sourceUrl && currentImageId) {
			statements.push(
				database
					.prepare(
						`INSERT INTO images (
							image_id, site, source_url, first_seen_at, last_seen_at,
							latest_alt, screenshot_crop_key
						) VALUES (?, ?, ?, ?, ?, ?, ?)
						ON CONFLICT(image_id) DO UPDATE SET
							first_seen_at = MIN(first_seen_at, excluded.first_seen_at),
							last_seen_at = MAX(last_seen_at, excluded.last_seen_at),
							latest_alt = COALESCE(excluded.latest_alt, images.latest_alt),
							screenshot_crop_key = COALESCE(
								excluded.screenshot_crop_key, images.screenshot_crop_key
							)`,
					)
					.bind(
						currentImageId,
						document.capture.site,
						sourceUrl,
						document.capture.capturedAt,
						document.capture.capturedAt,
						element.image?.alt ?? null,
						element.image?.cropKey ?? null,
					),
			);
		}
		statements.push(
			database
				.prepare(
					`INSERT INTO page_elements (
						capture_id, placement_key, element_key, kind, canonical_url, headline, category, section,
						prominence, summary, image_id, image_source_url, image_alt, image_crop_key,
						text_fingerprint, selector_hint, rank, top, left_position, width, height,
						viewport_depth
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					document.capture.captureId,
					pageElementPlacementKey(element),
					element.elementKey,
					element.kind,
					element.canonicalUrl ?? null,
					element.headline ?? null,
					category,
					element.section ?? null,
					element.prominence ?? null,
					element.summary ?? null,
					currentImageId,
					sourceUrl ?? null,
					element.image?.alt ?? null,
					element.image?.cropKey ?? null,
					element.textFingerprint,
					element.selectorHint ?? null,
					element.position.pageOrder,
					element.position.top,
					element.position.left,
					element.position.width,
					element.position.height,
					element.position.viewportDepth,
				),
			database
				.prepare(
					`INSERT INTO content_observation_search (
						capture_id, placement_key, element_key, site, headline, summary, category, image_alt
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					document.capture.captureId,
					pageElementPlacementKey(element),
					element.elementKey,
					document.capture.site,
					element.headline ?? "",
					element.summary ?? "",
					category,
					element.image?.alt ?? "",
				),
		);
	}
	return statements;
}

function changeStatement(
	database: D1Database,
	site: string,
	device: string,
	change: ChangeEvent,
): D1PreparedStatement {
	return database
		.prepare(
			`INSERT INTO change_events (
				change_id, site, device, previous_capture_id, current_capture_id,
				element_key, placement_key, change_type, before_value, after_value,
				magnitude, extractor_name, extractor_version, schema_version, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(change_id) DO UPDATE SET
				before_value = excluded.before_value,
				after_value = excluded.after_value,
				magnitude = excluded.magnitude,
				created_at = excluded.created_at`,
		)
		.bind(
			change.changeId,
			site,
			device,
			change.previousCaptureId,
			change.currentCaptureId,
			change.elementKey ?? null,
			change.placementKey ?? null,
			change.type,
			JSON.stringify(change.before),
			JSON.stringify(change.after),
			change.magnitude ?? null,
			change.extractorName,
			change.extractorVersion,
			change.schemaVersion,
			new Date().toISOString(),
		);
}

async function captureNeighbour(
	database: D1Database,
	document: PageExtraction,
	direction: "previous" | "next",
): Promise<string | null> {
	const comparison = direction === "previous" ? "<" : ">";
	const order = direction === "previous" ? "DESC" : "ASC";
	const row = await database
		.prepare(
			`SELECT capture_id
			FROM analysed_captures
			WHERE site = ? AND device = ? AND captured_at ${comparison} ?
			ORDER BY captured_at ${order}, capture_id ${order}
			LIMIT 1`,
		)
		.bind(document.capture.site, document.capture.device, document.capture.capturedAt)
		.first<{ capture_id: string }>();
	return row?.capture_id ?? null;
}

async function replaceAdjacentEdges(
	database: D1Database,
	document: PageExtraction,
): Promise<number> {
	const previousId = await captureNeighbour(database, document, "previous");
	const nextId = await captureNeighbour(database, document, "next");
	const currentId = document.capture.captureId;
	const statements: D1PreparedStatement[] = [
		database
			.prepare(
				`DELETE FROM change_events
				WHERE previous_capture_id = ? OR current_capture_id = ?
					OR (previous_capture_id = ? AND current_capture_id = ?)`,
			)
			.bind(currentId, currentId, previousId ?? "", nextId ?? ""),
	];
	let eventCount = 0;

	if (previousId) {
		const previous = await loadCaptureExtraction(database, previousId);
		if (!previous) {
			throw new Error(`Previous capture ${previousId} could not be loaded`);
		}
		const changes = await diffAdjacentCaptures(previous, document);
		eventCount += changes.length;
		statements.push(
			...changes.map((change) => {
				return changeStatement(database, document.capture.site, document.capture.device, change);
			}),
		);
	}

	if (nextId) {
		const next = await loadCaptureExtraction(database, nextId);
		if (!next) {
			throw new Error(`Next capture ${nextId} could not be loaded`);
		}
		const changes = await diffAdjacentCaptures(document, next);
		eventCount += changes.length;
		statements.push(
			...changes.map((change) => {
				return changeStatement(database, document.capture.site, document.capture.device, change);
			}),
		);
	}

	await database.batch(statements);
	return eventCount;
}

export async function ingestExtraction(
	database: D1Database,
	extractionKey: string,
	document: PageExtraction,
	artefactMetrics?: { compressedBytes: number; decompressedBytes: number },
): Promise<{ changeCount: number }> {
	await database.exec("PRAGMA foreign_keys = ON");
	const captureId = document.capture.captureId;
	const resetStatements = [
		captureStatement(database, extractionKey, document),
		database.prepare("DELETE FROM content_observation_search WHERE capture_id = ?").bind(captureId),
		database.prepare("DELETE FROM page_elements WHERE capture_id = ?").bind(captureId),
		...contentStatements(database, document),
	];
	await database.batch(resetStatements);
	const changeCount = await replaceAdjacentEdges(database, document);

	if (artefactMetrics) {
		const imageCount = new Set(
			document.elements.flatMap(({ image }) => (image?.sourceUrl ? [image.sourceUrl] : [])),
		).size;
		const d1StatementCount = resetStatements.length + changeCount + 2;
		await database
			.prepare(
				`INSERT INTO history_ingestion_metrics (
					capture_id, site, compressed_bytes, decompressed_bytes, element_count,
					content_count, image_count, change_count, d1_statement_count, indexed_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(capture_id) DO UPDATE SET
					compressed_bytes = excluded.compressed_bytes,
					decompressed_bytes = excluded.decompressed_bytes,
					element_count = excluded.element_count,
					content_count = excluded.content_count,
					image_count = excluded.image_count,
					change_count = excluded.change_count,
					d1_statement_count = excluded.d1_statement_count,
					indexed_at = excluded.indexed_at`,
			)
			.bind(
				document.capture.captureId,
				document.capture.site,
				artefactMetrics.compressedBytes,
				artefactMetrics.decompressedBytes,
				document.elements.length,
				document.elements.length,
				imageCount,
				changeCount,
				d1StatementCount,
				new Date().toISOString(),
			)
			.run();
	}

	return { changeCount };
}
