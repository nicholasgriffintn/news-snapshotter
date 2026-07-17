import { diffAdjacentCaptures, type ChangeEvent } from "../domain/changes.ts";
import type { PageElement, PageExtraction } from "../domain/extraction.ts";
import { storyCategory } from "../domain/story-classification.ts";

type CaptureRow = {
	capture_id: string;
	captured_at: string;
	content_hash: string;
	device: "desktop";
	extraction_key: string;
	extractor_name: string;
	extractor_version: number;
	html_key: string;
	page_height: number;
	page_width: number;
	profile: string;
	sanitisation_version: number;
	schema_version: number;
	screenshot_key: string;
	site: string;
	source_url: string;
	structure_hash: string;
	triggered_at: string;
};

type ObservationRow = {
	canonical_url: string | null;
	category: string | null;
	element_key: string;
	headline: string | null;
	height: number;
	image_alt: string | null;
	image_crop_key: string | null;
	image_source_url: string | null;
	kind: PageElement["kind"];
	left_position: number;
	prominence: PageElement["prominence"] | null;
	rank: number;
	section: string | null;
	selector_hint: string | null;
	summary: string | null;
	text_fingerprint: string;
	top: number;
	viewport_depth: number;
	width: number;
};

export type CaptureCursor = {
	capturedAt: string;
	captureId: string;
};

export type HistoryListOptions = {
	cursor?: CaptureCursor;
	from?: string;
	limit: number;
	to?: string;
};

export type ChangeListOptions = Omit<HistoryListOptions, "cursor"> & {
	cursor?: {
		capturedAt: string;
		changeId: string;
	};
	type?: string;
};

function storyId(site: string, element: PageElement): string {
	return `${site}:${element.canonicalUrl ?? element.elementKey}`;
}

function imageId(site: string, sourceUrl: string): string {
	return `${site}:${sourceUrl}`;
}

function optional<T>(value: T | null): T | undefined {
	return value === null ? undefined : value;
}

function rowToElement(row: ObservationRow): PageElement {
	const image =
		row.image_alt !== null || row.image_crop_key !== null || row.image_source_url !== null
			? {
					alt: optional(row.image_alt),
					cropKey: optional(row.image_crop_key),
					sourceUrl: optional(row.image_source_url),
				}
			: undefined;

	return {
		canonicalUrl: optional(row.canonical_url),
		category: optional(row.category),
		elementKey: row.element_key,
		headline: optional(row.headline),
		image,
		kind: row.kind,
		position: {
			height: row.height,
			left: row.left_position,
			pageOrder: row.rank,
			top: row.top,
			viewportDepth: row.viewport_depth,
			width: row.width,
		},
		prominence: optional(row.prominence),
		section: optional(row.section),
		selectorHint: optional(row.selector_hint),
		summary: optional(row.summary),
		textFingerprint: row.text_fingerprint,
	};
}

async function loadCaptureExtraction(
	database: D1Database,
	captureId: string,
): Promise<PageExtraction | null> {
	const capture = await database
		.prepare("SELECT * FROM analysed_captures WHERE capture_id = ?")
		.bind(captureId)
		.first<CaptureRow>();
	if (!capture) return null;

	const stories = await database
		.prepare(
			`SELECT
				stories.canonical_url,
				story_observations.category,
				story_observations.element_key,
				story_observations.headline,
				story_observations.height,
				story_observations.image_alt,
				story_observations.image_crop_key,
				story_observations.image_source_url,
				'story' AS kind,
				story_observations.left_position,
				story_observations.prominence,
				story_observations.rank,
				story_observations.section,
				NULL AS selector_hint,
				story_observations.summary,
				story_observations.text_fingerprint,
				story_observations.top,
				story_observations.viewport_depth,
				story_observations.width
			FROM story_observations
			JOIN stories ON stories.story_id = story_observations.story_id
			WHERE story_observations.capture_id = ?
			ORDER BY story_observations.rank`,
		)
		.bind(captureId)
		.all<ObservationRow>();
	const pageElements = await database
		.prepare(
			`SELECT
				canonical_url,
				NULL AS category,
				element_key,
				headline,
				height,
				NULL AS image_alt,
				NULL AS image_crop_key,
				NULL AS image_source_url,
				kind,
				left_position,
				NULL AS prominence,
				rank,
				NULL AS section,
				selector_hint,
				NULL AS summary,
				text_fingerprint,
				top,
				viewport_depth,
				width
			FROM page_elements
			WHERE capture_id = ?
			ORDER BY rank`,
		)
		.bind(captureId)
		.all<ObservationRow>();

	return {
		capture: {
			captureId: capture.capture_id,
			capturedAt: capture.captured_at,
			device: capture.device,
			extractor: {
				name: capture.extractor_name,
				version: capture.extractor_version,
			},
			htmlKey: capture.html_key,
			pageHeight: capture.page_height,
			pageWidth: capture.page_width,
			profile: capture.profile,
			sanitisationVersion: capture.sanitisation_version,
			schemaVersion: capture.schema_version,
			screenshotKey: capture.screenshot_key,
			site: capture.site,
			sourceUrl: capture.source_url,
			triggeredAt: capture.triggered_at,
		},
		contentHash: capture.content_hash,
		elements: [...stories.results, ...pageElements.results]
			.map(rowToElement)
			.sort((left, right) => left.position.pageOrder - right.position.pageOrder),
		structureHash: capture.structure_hash,
		warnings: [],
	};
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
				sanitisation_version, profile, status, indexed_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'indexed', ?)
			ON CONFLICT(capture_id) DO UPDATE SET
				extraction_key = excluded.extraction_key,
				content_hash = excluded.content_hash,
				structure_hash = excluded.structure_hash,
				page_width = excluded.page_width,
				page_height = excluded.page_height,
				extractor_name = excluded.extractor_name,
				extractor_version = excluded.extractor_version,
				schema_version = excluded.schema_version,
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
			new Date().toISOString(),
		);
}

function storyStatements(database: D1Database, document: PageExtraction): D1PreparedStatement[] {
	const statements: D1PreparedStatement[] = [];
	for (const element of document.elements) {
		if (element.kind !== "story") continue;
		const id = storyId(document.capture.site, element);
		const sourceUrl = element.image?.sourceUrl;
		const currentImageId = sourceUrl ? imageId(document.capture.site, sourceUrl) : null;
		const category = storyCategory(element.canonicalUrl, element.category ?? element.section);

		statements.push(
			database
				.prepare(
					`INSERT INTO stories (story_id, site, canonical_url, first_seen_at, last_seen_at)
					VALUES (?, ?, ?, ?, ?)
					ON CONFLICT(story_id) DO UPDATE SET
						first_seen_at = MIN(first_seen_at, excluded.first_seen_at),
						last_seen_at = MAX(last_seen_at, excluded.last_seen_at),
						canonical_url = COALESCE(stories.canonical_url, excluded.canonical_url)`,
				)
				.bind(
					id,
					document.capture.site,
					element.canonicalUrl ?? null,
					document.capture.capturedAt,
					document.capture.capturedAt,
				),
		);
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
					`INSERT INTO story_observations (
						capture_id, story_id, element_key, headline, summary, image_id,
						image_source_url, image_alt, image_crop_key, category, section, prominence, rank,
						top, left_position, width, height, viewport_depth, text_fingerprint
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					document.capture.captureId,
					id,
					element.elementKey,
					element.headline ?? null,
					element.summary ?? null,
					currentImageId,
					sourceUrl ?? null,
					element.image?.alt ?? null,
					element.image?.cropKey ?? null,
					category,
					element.section ?? null,
					element.prominence ?? null,
					element.position.pageOrder,
					element.position.top,
					element.position.left,
					element.position.width,
					element.position.height,
					element.position.viewportDepth,
					element.textFingerprint,
				),
			database
				.prepare(
					`INSERT INTO story_observation_search (
						capture_id, story_id, site, headline, summary, category, image_alt
					) VALUES (?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					document.capture.captureId,
					id,
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

function pageElementStatements(
	database: D1Database,
	document: PageExtraction,
): D1PreparedStatement[] {
	return document.elements
		.filter((element) => element.kind !== "story")
		.map((element) => {
			return database
				.prepare(
					`INSERT INTO page_elements (
						capture_id, element_key, kind, canonical_url, headline, text_fingerprint,
						selector_hint, rank, top, left_position, width, height, viewport_depth
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					document.capture.captureId,
					element.elementKey,
					element.kind,
					element.canonicalUrl ?? null,
					element.headline ?? null,
					element.textFingerprint,
					element.selectorHint ?? null,
					element.position.pageOrder,
					element.position.top,
					element.position.left,
					element.position.width,
					element.position.height,
					element.position.viewportDepth,
				);
		});
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
				story_id, element_key, change_type, before_value, after_value,
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
			change.storyId ?? null,
			change.elementKey ?? null,
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
		if (!previous) throw new Error(`Previous capture ${previousId} could not be loaded`);
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
		if (!next) throw new Error(`Next capture ${nextId} could not be loaded`);
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
		database.prepare("DELETE FROM story_observation_search WHERE capture_id = ?").bind(captureId),
		database.prepare("DELETE FROM story_observations WHERE capture_id = ?").bind(captureId),
		database.prepare("DELETE FROM page_elements WHERE capture_id = ?").bind(captureId),
		...storyStatements(database, document),
		...pageElementStatements(database, document),
	];
	await database.batch(resetStatements);
	const changeCount = await replaceAdjacentEdges(database, document);

	if (artefactMetrics) {
		const stories = document.elements.filter(({ kind }) => kind === "story");
		const imageCount = new Set(
			stories.flatMap(({ image }) => (image?.sourceUrl ? [image.sourceUrl] : [])),
		).size;
		const d1StatementCount = resetStatements.length + changeCount + 2;
		await database
			.prepare(
				`INSERT INTO history_ingestion_metrics (
					capture_id, site, compressed_bytes, decompressed_bytes, element_count,
					story_count, image_count, change_count, d1_statement_count, indexed_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(capture_id) DO UPDATE SET
					compressed_bytes = excluded.compressed_bytes,
					decompressed_bytes = excluded.decompressed_bytes,
					element_count = excluded.element_count,
					story_count = excluded.story_count,
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
				stories.length,
				imageCount,
				changeCount,
				d1StatementCount,
				new Date().toISOString(),
			)
			.run();
	}

	return { changeCount };
}

export async function listCaptures(
	database: D1Database,
	site: string,
	options: HistoryListOptions,
): Promise<{ captures: Record<string, unknown>[]; nextCursor?: CaptureCursor }> {
	const conditions = ["site = ?", "status = 'indexed'"];
	const parameters: Array<number | string> = [site];
	if (options.from) {
		conditions.push("captured_at >= ?");
		parameters.push(options.from);
	}
	if (options.to) {
		conditions.push("captured_at <= ?");
		parameters.push(options.to);
	}
	if (options.cursor) {
		conditions.push("(captured_at < ? OR (captured_at = ? AND capture_id < ?))");
		parameters.push(options.cursor.capturedAt, options.cursor.capturedAt, options.cursor.captureId);
	}
	parameters.push(options.limit + 1);

	const result = await database
		.prepare(
			`SELECT
				capture_id AS captureId, captured_at AS capturedAt, triggered_at AS triggeredAt,
				device, source_url AS sourceUrl, screenshot_key AS screenshotKey,
				page_width AS pageWidth, page_height AS pageHeight,
				extractor_name AS extractorName, extractor_version AS extractorVersion,
				schema_version AS schemaVersion, content_hash AS contentHash,
				structure_hash AS structureHash
			FROM analysed_captures
			WHERE ${conditions.join(" AND ")}
			ORDER BY captured_at DESC, capture_id DESC
			LIMIT ?`,
		)
		.bind(...parameters)
		.all<Record<string, unknown>>();
	const hasMore = result.results.length > options.limit;
	const captures = result.results.slice(0, options.limit);
	const last = captures.at(-1);
	const nextCursor =
		hasMore && last
			? { capturedAt: String(last.capturedAt), captureId: String(last.captureId) }
			: undefined;
	return { captures, nextCursor };
}

export async function listHistorySites(database: D1Database): Promise<Record<string, unknown>[]> {
	const result = await database
		.prepare(
			`SELECT
				analysed_captures.site,
				analysed_captures.device,
				COUNT(DISTINCT analysed_captures.capture_id) AS captureCount,
				MIN(analysed_captures.captured_at) AS firstCaptureAt,
				MAX(analysed_captures.captured_at) AS lastCaptureAt,
				MAX(analysed_captures.source_url) AS sourceUrl,
				COUNT(DISTINCT story_observations.story_id) AS storyCount
			FROM analysed_captures
			LEFT JOIN story_observations
				ON story_observations.capture_id = analysed_captures.capture_id
			WHERE analysed_captures.status = 'indexed'
			GROUP BY analysed_captures.site, analysed_captures.device
			ORDER BY analysed_captures.site, analysed_captures.device`,
		)
		.all<Record<string, unknown>>();
	return result.results;
}

export async function getCapture(
	database: D1Database,
	site: string,
	captureId: string,
): Promise<PageExtraction | null> {
	const extraction = await loadCaptureExtraction(database, captureId);
	return extraction?.capture.site === site ? extraction : null;
}

export async function getStory(
	database: D1Database,
	site: string,
	id: string,
	options: HistoryListOptions,
): Promise<(Record<string, unknown> & { nextCursor?: CaptureCursor }) | null> {
	const story = await database
		.prepare(
			"SELECT story_id AS storyId, canonical_url AS canonicalUrl FROM stories WHERE site = ? AND story_id = ?",
		)
		.bind(site, id)
		.first<Record<string, unknown>>();
	if (!story) return null;
	const conditions = ["story_observations.story_id = ?"];
	const parameters: Array<number | string> = [id];
	if (options.from) {
		conditions.push("analysed_captures.captured_at >= ?");
		parameters.push(options.from);
	}
	if (options.to) {
		conditions.push("analysed_captures.captured_at <= ?");
		parameters.push(options.to);
	}
	if (options.cursor) {
		conditions.push(
			"(analysed_captures.captured_at > ? OR (analysed_captures.captured_at = ? AND story_observations.capture_id > ?))",
		);
		parameters.push(options.cursor.capturedAt, options.cursor.capturedAt, options.cursor.captureId);
	}
	parameters.push(options.limit + 1);
	const result = await database
		.prepare(
			`SELECT
				story_observations.capture_id AS captureId,
				analysed_captures.captured_at AS capturedAt,
				headline, summary, image_source_url AS imageSourceUrl, image_alt AS imageAlt,
				image_crop_key AS imageCropKey,
				category, section, prominence, rank, top, left_position AS left,
				width, height, viewport_depth AS viewportDepth
			FROM story_observations
			JOIN analysed_captures ON analysed_captures.capture_id = story_observations.capture_id
			WHERE ${conditions.join(" AND ")}
			ORDER BY analysed_captures.captured_at ASC, story_observations.capture_id ASC
			LIMIT ?`,
		)
		.bind(...parameters)
		.all<Record<string, unknown>>();
	const hasMore = result.results.length > options.limit;
	const observations = result.results.slice(0, options.limit);
	const last = observations.at(-1);
	return {
		...story,
		nextCursor:
			hasMore && last
				? { capturedAt: String(last.capturedAt), captureId: String(last.captureId) }
				: undefined,
		observations,
	};
}

export async function listChanges(
	database: D1Database,
	site: string,
	options: ChangeListOptions,
): Promise<{
	changes: Record<string, unknown>[];
	nextCursor?: { capturedAt: string; changeId: string };
}> {
	const conditions = ["change_events.site = ?"];
	const parameters: Array<number | string> = [site];
	if (options.from) {
		conditions.push("analysed_captures.captured_at >= ?");
		parameters.push(options.from);
	}
	if (options.to) {
		conditions.push("analysed_captures.captured_at <= ?");
		parameters.push(options.to);
	}
	if (options.type) {
		conditions.push("change_events.change_type = ?");
		parameters.push(options.type);
	}
	if (options.cursor) {
		conditions.push(
			"(analysed_captures.captured_at < ? OR (analysed_captures.captured_at = ? AND change_events.change_id < ?))",
		);
		parameters.push(options.cursor.capturedAt, options.cursor.capturedAt, options.cursor.changeId);
	}
	parameters.push(options.limit + 1);

	const result = await database
		.prepare(
			`SELECT
				change_id AS changeId, previous_capture_id AS previousCaptureId,
				current_capture_id AS currentCaptureId, story_id AS storyId,
				element_key AS elementKey, change_type AS type, before_value AS beforeValue,
				after_value AS afterValue, magnitude,
				change_events.extractor_name AS extractorName,
				change_events.extractor_version AS extractorVersion,
				change_events.schema_version AS schemaVersion,
				analysed_captures.captured_at AS capturedAt
			FROM change_events
			JOIN analysed_captures ON analysed_captures.capture_id = change_events.current_capture_id
			WHERE ${conditions.join(" AND ")}
			ORDER BY analysed_captures.captured_at DESC, change_events.change_id DESC
			LIMIT ?`,
		)
		.bind(...parameters)
		.all<Record<string, unknown>>();
	const hasMore = result.results.length > options.limit;
	const rows = result.results.slice(0, options.limit);
	const changes = rows.map((row) => {
		const { afterValue, beforeValue, ...details } = row;
		return {
			...details,
			after: JSON.parse(String(afterValue)),
			before: JSON.parse(String(beforeValue)),
		};
	});
	return {
		changes,
		nextCursor:
			hasMore && rows.at(-1)
				? {
						capturedAt: String(rows.at(-1)?.capturedAt),
						changeId: String(rows.at(-1)?.changeId),
					}
				: undefined,
	};
}
