import type { PageElement, PageExtraction } from "../domain/extraction.ts";

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
	warnings_json?: string | null;
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
	placement_key: string;
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

function rowToElement(row: ObservationRow): PageElement {
	const image =
		row.image_alt !== null || row.image_crop_key !== null || row.image_source_url !== null
			? {
					alt: row.image_alt ?? undefined,
					cropKey: row.image_crop_key ?? undefined,
					sourceUrl: row.image_source_url ?? undefined,
				}
			: undefined;

	return {
		canonicalUrl: row.canonical_url ?? undefined,
		category: row.category ?? undefined,
		elementKey: row.element_key,
		headline: row.headline ?? undefined,
		image,
		kind: row.kind,
		placementKey: row.placement_key,
		position: {
			height: row.height,
			left: row.left_position,
			pageOrder: row.rank,
			top: row.top,
			viewportDepth: row.viewport_depth,
			width: row.width,
		},
		prominence: row.prominence ?? undefined,
		section: row.section ?? undefined,
		selectorHint: row.selector_hint ?? undefined,
		summary: row.summary ?? undefined,
		textFingerprint: row.text_fingerprint,
	};
}

export async function loadCaptureExtraction(
	database: D1Database,
	captureId: string,
): Promise<PageExtraction | null> {
	const capture = await database
		.prepare("SELECT * FROM analysed_captures WHERE capture_id = ?")
		.bind(captureId)
		.first<CaptureRow>();
	if (!capture) {
		return null;
	}

	const observations = await database
		.prepare(
			`SELECT
				canonical_url,
				category,
				element_key,
				headline,
				height,
				image_alt,
				image_crop_key,
				image_source_url,
				kind,
				left_position,
				placement_key,
				prominence,
				rank,
				section,
				selector_hint,
				summary,
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
		elements: observations.results.map(rowToElement),
		structureHash: capture.structure_hash,
		warnings:
			capture.warnings_json === undefined || capture.warnings_json === null
				? []
				: (JSON.parse(capture.warnings_json) as PageExtraction["warnings"]),
	};
}
