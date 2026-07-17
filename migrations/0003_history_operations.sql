CREATE TABLE history_ingestion_metrics (
	capture_id TEXT PRIMARY KEY REFERENCES analysed_captures(capture_id) ON DELETE CASCADE,
	site TEXT NOT NULL,
	compressed_bytes INTEGER NOT NULL,
	decompressed_bytes INTEGER NOT NULL,
	element_count INTEGER NOT NULL,
	story_count INTEGER NOT NULL,
	image_count INTEGER NOT NULL,
	change_count INTEGER NOT NULL,
	d1_statement_count INTEGER NOT NULL,
	indexed_at TEXT NOT NULL
);

CREATE INDEX history_ingestion_metrics_site_time
	ON history_ingestion_metrics (site, indexed_at DESC, capture_id);

CREATE TABLE history_monthly_aggregates (
	site TEXT NOT NULL,
	month TEXT NOT NULL,
	mode TEXT NOT NULL CHECK (mode IN ('category', 'main-headline-words', 'all-headline-words')),
	label TEXT NOT NULL,
	observation_count INTEGER NOT NULL,
	weighted_seconds REAL NOT NULL,
	generated_at TEXT NOT NULL,
	PRIMARY KEY (site, month, mode, label)
);

CREATE INDEX history_monthly_aggregates_site_month
	ON history_monthly_aggregates (site, month DESC, mode, weighted_seconds DESC);

ALTER TABLE images ADD COLUMN screenshot_crop_key TEXT;
ALTER TABLE story_observations ADD COLUMN image_crop_key TEXT;
