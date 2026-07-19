DROP INDEX change_events_site_timeline;
DROP INDEX change_events_story_timeline;
DROP INDEX change_events_edge;

CREATE TABLE unified_change_events (
	change_id TEXT PRIMARY KEY,
	site TEXT NOT NULL,
	device TEXT NOT NULL,
	previous_capture_id TEXT NOT NULL REFERENCES analysed_captures(capture_id) ON DELETE CASCADE,
	current_capture_id TEXT NOT NULL REFERENCES analysed_captures(capture_id) ON DELETE CASCADE,
	element_key TEXT,
	change_type TEXT NOT NULL,
	before_value TEXT NOT NULL,
	after_value TEXT NOT NULL,
	magnitude REAL,
	extractor_name TEXT NOT NULL,
	extractor_version INTEGER NOT NULL,
	schema_version INTEGER NOT NULL,
	created_at TEXT NOT NULL
);

INSERT INTO unified_change_events (
	change_id, site, device, previous_capture_id, current_capture_id, element_key,
	change_type, before_value, after_value, magnitude, extractor_name,
	extractor_version, schema_version, created_at
)
SELECT
	change_id, site, device, previous_capture_id, current_capture_id, element_key,
	change_type, before_value, after_value, magnitude, extractor_name,
	extractor_version, schema_version, created_at
FROM change_events;

DROP TABLE change_events;
ALTER TABLE unified_change_events RENAME TO change_events;

CREATE INDEX change_events_site_timeline
	ON change_events (site, device, current_capture_id, change_type, change_id);
CREATE INDEX change_events_element_timeline
	ON change_events (element_key, current_capture_id, change_id);
CREATE INDEX change_events_edge
	ON change_events (previous_capture_id, current_capture_id, change_id);

DROP TABLE saved_timeline_stories;
DROP TABLE story_observation_search;
DROP TABLE story_observations;
DROP TABLE stories;

DROP INDEX history_ingestion_metrics_site_time;
CREATE TABLE unified_history_ingestion_metrics (
	capture_id TEXT PRIMARY KEY REFERENCES analysed_captures(capture_id) ON DELETE CASCADE,
	site TEXT NOT NULL,
	compressed_bytes INTEGER NOT NULL,
	decompressed_bytes INTEGER NOT NULL,
	element_count INTEGER NOT NULL,
	content_count INTEGER NOT NULL,
	image_count INTEGER NOT NULL,
	change_count INTEGER NOT NULL,
	d1_statement_count INTEGER NOT NULL,
	indexed_at TEXT NOT NULL
);

INSERT INTO unified_history_ingestion_metrics (
	capture_id, site, compressed_bytes, decompressed_bytes, element_count,
	content_count, image_count, change_count, d1_statement_count, indexed_at
)
SELECT
	capture_id, site, compressed_bytes, decompressed_bytes, element_count,
	content_count, image_count, change_count, d1_statement_count, indexed_at
FROM history_ingestion_metrics;

DROP TABLE history_ingestion_metrics;
ALTER TABLE unified_history_ingestion_metrics RENAME TO history_ingestion_metrics;
CREATE INDEX history_ingestion_metrics_site_time
	ON history_ingestion_metrics (site, indexed_at DESC, capture_id);
