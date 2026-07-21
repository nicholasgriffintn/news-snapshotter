CREATE TABLE comparison_windows (
	window_id TEXT PRIMARY KEY,
	cohort_id TEXT NOT NULL,
	starts_at TEXT NOT NULL,
	ends_at TEXT NOT NULL,
	expected_site_count INTEGER NOT NULL CHECK (expected_site_count >= 0),
	captured_site_count INTEGER NOT NULL DEFAULT 0 CHECK (captured_site_count >= 0),
	analysed_site_count INTEGER NOT NULL DEFAULT 0 CHECK (analysed_site_count >= 0),
	status TEXT NOT NULL CHECK (status IN ('pending', 'complete', 'partial', 'suppressed', 'failed')),
	finalised_at TEXT,
	UNIQUE (cohort_id, starts_at)
);

CREATE INDEX comparison_windows_timeline
	ON comparison_windows (cohort_id, starts_at DESC, window_id DESC);

CREATE TABLE comparison_window_sites (
	window_id TEXT NOT NULL REFERENCES comparison_windows(window_id) ON DELETE CASCADE,
	site TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('expected', 'captured', 'analysed', 'failed')),
	capture_id TEXT REFERENCES analysed_captures(capture_id) ON DELETE SET NULL,
	failure_reason TEXT,
	updated_at TEXT NOT NULL,
	PRIMARY KEY (window_id, site)
);

CREATE INDEX comparison_window_sites_status
	ON comparison_window_sites (window_id, status, site);

CREATE TABLE analysis_runs (
	run_id TEXT PRIMARY KEY,
	idempotency_key TEXT NOT NULL UNIQUE,
	kind TEXT NOT NULL CHECK (
		kind IN ('capture-annotation', 'pair-verification', 'story-comparison', 'window-finalisation')
	),
	capture_id TEXT REFERENCES analysed_captures(capture_id) ON DELETE SET NULL,
	story_id TEXT,
	window_id TEXT REFERENCES comparison_windows(window_id) ON DELETE SET NULL,
	input_hash TEXT NOT NULL,
	pipeline_version INTEGER NOT NULL,
	taxonomy_version INTEGER NOT NULL,
	prompt_version INTEGER NOT NULL,
	schema_version INTEGER NOT NULL,
	model TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'abstained')),
	attempt_count INTEGER NOT NULL DEFAULT 0,
	input_tokens INTEGER,
	output_tokens INTEGER,
	ai_gateway_log_id TEXT,
	input_r2_key TEXT,
	output_r2_key TEXT,
	error_code TEXT,
	error_message TEXT,
	created_at TEXT NOT NULL,
	started_at TEXT,
	completed_at TEXT
);

CREATE INDEX analysis_runs_status
	ON analysis_runs (status, kind, created_at DESC, run_id);
CREATE INDEX analysis_runs_capture
	ON analysis_runs (capture_id, kind, created_at DESC, run_id);

CREATE TABLE content_annotations (
	run_id TEXT NOT NULL REFERENCES analysis_runs(run_id) ON DELETE CASCADE,
	capture_id TEXT NOT NULL REFERENCES analysed_captures(capture_id) ON DELETE CASCADE,
	placement_key TEXT NOT NULL,
	element_key TEXT NOT NULL,
	evidence_id TEXT NOT NULL,
	normalised_label TEXT NOT NULL,
	topics_json TEXT NOT NULL,
	entities_json TEXT NOT NULL,
	locations_json TEXT NOT NULL,
	framing_json TEXT NOT NULL,
	confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
	embedding_id TEXT,
	PRIMARY KEY (run_id, capture_id, placement_key),
	UNIQUE (run_id, evidence_id)
);

CREATE INDEX content_annotations_capture
	ON content_annotations (capture_id, confidence DESC, placement_key);

CREATE TABLE comparison_stories (
	story_id TEXT PRIMARY KEY,
	cohort_id TEXT NOT NULL,
	slug TEXT NOT NULL UNIQUE,
	normalised_label TEXT NOT NULL,
	first_seen_at TEXT NOT NULL,
	last_seen_at TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('open', 'closed', 'merged', 'withdrawn')),
	current_revision_id TEXT
);

CREATE INDEX comparison_stories_timeline
	ON comparison_stories (cohort_id, last_seen_at DESC, story_id);

CREATE TABLE story_memberships (
	story_id TEXT NOT NULL REFERENCES comparison_stories(story_id) ON DELETE CASCADE,
	cohort_id TEXT NOT NULL,
	capture_id TEXT NOT NULL REFERENCES analysed_captures(capture_id) ON DELETE CASCADE,
	placement_key TEXT NOT NULL,
	annotation_run_id TEXT NOT NULL REFERENCES analysis_runs(run_id) ON DELETE RESTRICT,
	site TEXT NOT NULL,
	pipeline_version INTEGER NOT NULL,
	embedding_similarity REAL,
	verifier_confidence REAL,
	membership_reason TEXT NOT NULL,
	active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
	created_at TEXT NOT NULL,
	PRIMARY KEY (story_id, capture_id, placement_key, pipeline_version)
);

CREATE UNIQUE INDEX story_memberships_active_placement
	ON story_memberships (cohort_id, capture_id, placement_key, pipeline_version)
	WHERE active = 1;
CREATE INDEX story_memberships_story
	ON story_memberships (story_id, active, site, capture_id);

CREATE TABLE story_revisions (
	revision_id TEXT PRIMARY KEY,
	story_id TEXT NOT NULL REFERENCES comparison_stories(story_id) ON DELETE CASCADE,
	run_id TEXT NOT NULL REFERENCES analysis_runs(run_id) ON DELETE RESTRICT,
	window_id TEXT REFERENCES comparison_windows(window_id) ON DELETE SET NULL,
	summary TEXT,
	common_ground_json TEXT NOT NULL,
	differences_json TEXT NOT NULL,
	analysis_status TEXT NOT NULL DEFAULT 'unavailable'
		CHECK (analysis_status IN ('available', 'unavailable')),
	confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
	source_count INTEGER NOT NULL CHECK (source_count >= 0),
	left_source_count INTEGER NOT NULL DEFAULT 0,
	centre_source_count INTEGER NOT NULL DEFAULT 0,
	right_source_count INTEGER NOT NULL DEFAULT 0,
	unrated_source_count INTEGER NOT NULL DEFAULT 0,
	evidence_count INTEGER NOT NULL CHECK (evidence_count >= 0),
	perspective_snapshot_json TEXT NOT NULL,
	r2_document_key TEXT NOT NULL,
	created_at TEXT NOT NULL,
	withdrawn_at TEXT,
	withdrawal_reason TEXT
);

CREATE INDEX story_revisions_story
	ON story_revisions (story_id, created_at DESC, revision_id);
CREATE INDEX story_revisions_analysis_status
	ON story_revisions (analysis_status, created_at DESC, revision_id);

CREATE TABLE story_topics (
	revision_id TEXT NOT NULL REFERENCES story_revisions(revision_id) ON DELETE CASCADE,
	story_id TEXT NOT NULL REFERENCES comparison_stories(story_id) ON DELETE CASCADE,
	topic TEXT NOT NULL,
	PRIMARY KEY (revision_id, topic)
);

CREATE INDEX story_topics_lookup ON story_topics (topic, story_id, revision_id);

CREATE TABLE story_revision_evidence (
	revision_id TEXT NOT NULL REFERENCES story_revisions(revision_id) ON DELETE CASCADE,
	evidence_id TEXT NOT NULL,
	annotation_run_id TEXT NOT NULL REFERENCES analysis_runs(run_id) ON DELETE RESTRICT,
	capture_id TEXT NOT NULL REFERENCES analysed_captures(capture_id) ON DELETE RESTRICT,
	placement_key TEXT NOT NULL,
	site TEXT NOT NULL,
	PRIMARY KEY (revision_id, evidence_id),
	UNIQUE (revision_id, capture_id, placement_key)
);

CREATE INDEX story_revision_evidence_capture
	ON story_revision_evidence (capture_id, placement_key, revision_id);

CREATE TABLE analysis_feedback (
	feedback_id TEXT PRIMARY KEY,
	revision_id TEXT NOT NULL REFERENCES story_revisions(revision_id) ON DELETE RESTRICT,
	evidence_id TEXT,
	reason TEXT NOT NULL CHECK (reason IN ('unsupported', 'incorrect', 'missing-context', 'other')),
	note TEXT,
	submitted_at TEXT NOT NULL,
	review_status TEXT NOT NULL DEFAULT 'pending'
		CHECK (review_status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
	resolution TEXT,
	resolved_at TEXT
);

CREATE INDEX analysis_feedback_review
	ON analysis_feedback (review_status, submitted_at DESC, feedback_id);
CREATE INDEX analysis_feedback_corrections
	ON analysis_feedback (review_status, resolved_at DESC, feedback_id);
