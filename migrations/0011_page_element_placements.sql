CREATE TABLE page_element_placements (
	capture_id TEXT NOT NULL REFERENCES analysed_captures(capture_id) ON DELETE CASCADE,
	placement_key TEXT NOT NULL,
	element_key TEXT NOT NULL,
	kind TEXT NOT NULL,
	canonical_url TEXT,
	headline TEXT,
	text_fingerprint TEXT NOT NULL,
	selector_hint TEXT,
	rank INTEGER NOT NULL,
	top REAL NOT NULL,
	left_position REAL NOT NULL,
	width REAL NOT NULL,
	height REAL NOT NULL,
	viewport_depth REAL NOT NULL,
	category TEXT,
	section TEXT,
	prominence TEXT CHECK (prominence IN ('lead', 'major', 'standard', 'minor')),
	summary TEXT,
	image_id TEXT REFERENCES images(image_id) ON DELETE SET NULL,
	image_source_url TEXT,
	image_alt TEXT,
	image_crop_key TEXT,
	PRIMARY KEY (capture_id, placement_key)
);

INSERT INTO page_element_placements (
	capture_id, placement_key, element_key, kind, canonical_url, headline,
	text_fingerprint, selector_hint, rank, top, left_position, width, height,
	viewport_depth, category, section, prominence, summary, image_id,
	image_source_url, image_alt, image_crop_key
)
SELECT
	capture_id, element_key, element_key, kind, canonical_url, headline,
	text_fingerprint, selector_hint, rank, top, left_position, width, height,
	viewport_depth, category, section, prominence, summary, image_id,
	image_source_url, image_alt, image_crop_key
FROM page_elements;

DROP TABLE page_elements;
ALTER TABLE page_element_placements RENAME TO page_elements;

CREATE INDEX page_elements_element_timeline
	ON page_elements (element_key, capture_id);

DROP TABLE content_observation_search;
CREATE VIRTUAL TABLE content_observation_search USING fts5(
	capture_id UNINDEXED,
	placement_key UNINDEXED,
	element_key UNINDEXED,
	site UNINDEXED,
	headline,
	summary,
	category,
	image_alt,
	tokenize = 'unicode61'
);

INSERT INTO content_observation_search (
	capture_id, placement_key, element_key, site, headline, summary, category, image_alt
)
SELECT
	page_elements.capture_id,
	page_elements.placement_key,
	page_elements.element_key,
	analysed_captures.site,
	COALESCE(page_elements.headline, ''),
	COALESCE(page_elements.summary, ''),
	COALESCE(page_elements.category, ''),
	COALESCE(page_elements.image_alt, '')
FROM page_elements
JOIN analysed_captures ON analysed_captures.capture_id = page_elements.capture_id;

ALTER TABLE change_events ADD COLUMN placement_key TEXT;
