PRAGMA foreign_keys = ON;

CREATE TABLE analysed_captures (
	capture_id TEXT PRIMARY KEY,
	site TEXT NOT NULL,
	device TEXT NOT NULL CHECK (device IN ('desktop', 'mobile')),
	captured_at TEXT NOT NULL,
	triggered_at TEXT NOT NULL,
	source_url TEXT NOT NULL,
	screenshot_key TEXT NOT NULL,
	html_key TEXT NOT NULL,
	extraction_key TEXT NOT NULL,
	content_hash TEXT NOT NULL,
	structure_hash TEXT NOT NULL,
	page_width REAL NOT NULL,
	page_height REAL NOT NULL,
	extractor_name TEXT NOT NULL,
	extractor_version INTEGER NOT NULL,
	schema_version INTEGER NOT NULL,
	sanitisation_version INTEGER NOT NULL,
	profile TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'indexed' CHECK (status IN ('pending', 'indexed', 'failed')),
	indexed_at TEXT NOT NULL,
	UNIQUE (site, device, captured_at)
);

CREATE INDEX analysed_captures_timeline
	ON analysed_captures (site, device, captured_at DESC, capture_id DESC);

CREATE TABLE stories (
	story_id TEXT PRIMARY KEY,
	site TEXT NOT NULL,
	canonical_url TEXT,
	first_seen_at TEXT NOT NULL,
	last_seen_at TEXT NOT NULL,
	UNIQUE (site, canonical_url)
);

CREATE INDEX stories_site_seen ON stories (site, last_seen_at DESC, story_id);

CREATE TABLE images (
	image_id TEXT PRIMARY KEY,
	site TEXT NOT NULL,
	source_url TEXT NOT NULL,
	first_seen_at TEXT NOT NULL,
	last_seen_at TEXT NOT NULL,
	latest_alt TEXT,
	UNIQUE (site, source_url)
);

CREATE INDEX images_site_seen ON images (site, last_seen_at DESC, image_id);

CREATE TABLE story_observations (
	capture_id TEXT NOT NULL REFERENCES analysed_captures(capture_id) ON DELETE CASCADE,
	story_id TEXT NOT NULL REFERENCES stories(story_id) ON DELETE CASCADE,
	element_key TEXT NOT NULL,
	headline TEXT,
	summary TEXT,
	image_id TEXT REFERENCES images(image_id) ON DELETE SET NULL,
	image_source_url TEXT,
	image_alt TEXT,
	category TEXT,
	section TEXT,
	prominence TEXT CHECK (prominence IN ('lead', 'major', 'standard', 'minor')),
	rank INTEGER NOT NULL,
	top REAL NOT NULL,
	left_position REAL NOT NULL,
	width REAL NOT NULL,
	height REAL NOT NULL,
	viewport_depth REAL NOT NULL,
	text_fingerprint TEXT NOT NULL,
	PRIMARY KEY (capture_id, element_key)
);

CREATE INDEX story_observations_story_timeline
	ON story_observations (story_id, capture_id);
CREATE INDEX story_observations_capture_rank
	ON story_observations (capture_id, rank, story_id);

CREATE TABLE page_elements (
	capture_id TEXT NOT NULL REFERENCES analysed_captures(capture_id) ON DELETE CASCADE,
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
	PRIMARY KEY (capture_id, element_key)
);

CREATE TABLE change_events (
	change_id TEXT PRIMARY KEY,
	site TEXT NOT NULL,
	device TEXT NOT NULL,
	previous_capture_id TEXT NOT NULL REFERENCES analysed_captures(capture_id) ON DELETE CASCADE,
	current_capture_id TEXT NOT NULL REFERENCES analysed_captures(capture_id) ON DELETE CASCADE,
	story_id TEXT REFERENCES stories(story_id) ON DELETE CASCADE,
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

CREATE INDEX change_events_site_timeline
	ON change_events (site, device, current_capture_id, change_type, change_id);
CREATE INDEX change_events_story_timeline
	ON change_events (story_id, current_capture_id, change_id);
CREATE INDEX change_events_edge
	ON change_events (previous_capture_id, current_capture_id, change_id);

CREATE TABLE extraction_failures (
	failure_id INTEGER PRIMARY KEY AUTOINCREMENT,
	capture_id TEXT,
	site TEXT,
	device TEXT,
	extraction_key TEXT,
	stage TEXT NOT NULL CHECK (stage IN ('parsing', 'validation', 'schema', 'indexing')),
	message TEXT NOT NULL,
	failed_at TEXT NOT NULL
);

CREATE INDEX extraction_failures_site_time
	ON extraction_failures (site, failed_at DESC, failure_id DESC);

CREATE TABLE saved_timelines (
	timeline_id TEXT PRIMARY KEY,
	slug TEXT NOT NULL UNIQUE,
	name TEXT NOT NULL,
	site TEXT NOT NULL,
	created_at TEXT NOT NULL
);

CREATE TABLE saved_timeline_stories (
	timeline_id TEXT NOT NULL REFERENCES saved_timelines(timeline_id) ON DELETE CASCADE,
	story_id TEXT NOT NULL REFERENCES stories(story_id) ON DELETE CASCADE,
	position INTEGER NOT NULL,
	PRIMARY KEY (timeline_id, story_id),
	UNIQUE (timeline_id, position)
);

CREATE VIRTUAL TABLE story_observation_search USING fts5(
	capture_id UNINDEXED,
	story_id UNINDEXED,
	site UNINDEXED,
	headline,
	summary,
	category,
	image_alt,
	tokenize = 'unicode61'
);
