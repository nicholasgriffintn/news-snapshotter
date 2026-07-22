ALTER TABLE analysed_captures
	ADD COLUMN warnings_json TEXT NOT NULL DEFAULT '[]';

CREATE TABLE analysis_feedback_next (
	feedback_id TEXT PRIMARY KEY,
	revision_id TEXT NOT NULL,
	story_id TEXT NOT NULL,
	story_label TEXT NOT NULL,
	evidence_id TEXT,
	reason TEXT NOT NULL CHECK (reason IN ('unsupported', 'incorrect', 'missing-context', 'other')),
	note TEXT,
	submitted_at TEXT NOT NULL,
	review_status TEXT NOT NULL DEFAULT 'pending'
		CHECK (review_status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
	resolution TEXT,
	resolved_at TEXT
);

INSERT INTO analysis_feedback_next (
	feedback_id, revision_id, story_id, story_label, evidence_id, reason, note,
	submitted_at, review_status, resolution, resolved_at
)
SELECT
	af.feedback_id,
	af.revision_id,
	r.story_id,
	s.normalised_label,
	af.evidence_id,
	af.reason,
	af.note,
	af.submitted_at,
	af.review_status,
	af.resolution,
	af.resolved_at
FROM analysis_feedback af
JOIN story_revisions r ON r.revision_id = af.revision_id
JOIN comparison_stories s ON s.story_id = r.story_id;

DROP TABLE analysis_feedback;
ALTER TABLE analysis_feedback_next RENAME TO analysis_feedback;

CREATE INDEX analysis_feedback_review
	ON analysis_feedback (review_status, submitted_at DESC, feedback_id);
CREATE INDEX analysis_feedback_corrections
	ON analysis_feedback (review_status, resolved_at DESC, feedback_id);
CREATE INDEX analysis_feedback_story
	ON analysis_feedback (story_id, submitted_at DESC, feedback_id);
