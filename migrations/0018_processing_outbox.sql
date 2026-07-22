CREATE TABLE processing_outbox (
	outbox_id TEXT PRIMARY KEY,
	destination TEXT NOT NULL CHECK (destination IN ('history-index', 'analysis')),
	message_json TEXT NOT NULL,
	created_at TEXT NOT NULL,
	attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
	last_attempt_at TEXT,
	last_error TEXT
);

CREATE INDEX processing_outbox_pending
	ON processing_outbox (created_at, outbox_id);
