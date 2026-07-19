ALTER TABLE page_elements ADD COLUMN summary TEXT;
ALTER TABLE page_elements ADD COLUMN image_id TEXT REFERENCES images(image_id) ON DELETE SET NULL;
ALTER TABLE page_elements ADD COLUMN image_source_url TEXT;
ALTER TABLE page_elements ADD COLUMN image_alt TEXT;
ALTER TABLE page_elements ADD COLUMN image_crop_key TEXT;

INSERT OR REPLACE INTO page_elements (
	capture_id, element_key, kind, canonical_url, headline, category, section,
	prominence, summary, image_id, image_source_url, image_alt, image_crop_key,
	text_fingerprint, selector_hint, rank, top, left_position, width, height, viewport_depth
)
SELECT
	story_observations.capture_id,
	story_observations.element_key,
	'story',
	stories.canonical_url,
	story_observations.headline,
	story_observations.category,
	story_observations.section,
	story_observations.prominence,
	story_observations.summary,
	story_observations.image_id,
	story_observations.image_source_url,
	story_observations.image_alt,
	story_observations.image_crop_key,
	story_observations.text_fingerprint,
	NULL,
	story_observations.rank,
	story_observations.top,
	story_observations.left_position,
	story_observations.width,
	story_observations.height,
	story_observations.viewport_depth
FROM story_observations
JOIN stories ON stories.story_id = story_observations.story_id;

CREATE VIRTUAL TABLE content_observation_search USING fts5(
	capture_id UNINDEXED,
	element_key UNINDEXED,
	site UNINDEXED,
	headline,
	summary,
	category,
	image_alt,
	tokenize = 'unicode61'
);

INSERT INTO content_observation_search (
	capture_id, element_key, site, headline, summary, category, image_alt
)
SELECT
	page_elements.capture_id,
	page_elements.element_key,
	analysed_captures.site,
	COALESCE(page_elements.headline, ''),
	COALESCE(page_elements.summary, ''),
	COALESCE(page_elements.category, ''),
	COALESCE(page_elements.image_alt, '')
FROM page_elements
JOIN analysed_captures ON analysed_captures.capture_id = page_elements.capture_id;

UPDATE change_events
SET element_key = substr(story_id, length(site) + 2)
WHERE element_key IS NULL AND story_id IS NOT NULL;

ALTER TABLE history_ingestion_metrics ADD COLUMN content_count INTEGER NOT NULL DEFAULT 0;
UPDATE history_ingestion_metrics SET content_count = element_count;

CREATE TABLE saved_timeline_elements (
	timeline_id TEXT NOT NULL REFERENCES saved_timelines(timeline_id) ON DELETE CASCADE,
	element_key TEXT NOT NULL,
	position INTEGER NOT NULL,
	PRIMARY KEY (timeline_id, element_key),
	UNIQUE (timeline_id, position)
);

INSERT INTO saved_timeline_elements (timeline_id, element_key, position)
SELECT
	saved_timeline_stories.timeline_id,
	COALESCE(stories.canonical_url, substr(stories.story_id, length(stories.site) + 2)),
	saved_timeline_stories.position
FROM saved_timeline_stories
JOIN stories ON stories.story_id = saved_timeline_stories.story_id;
