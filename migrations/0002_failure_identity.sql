ALTER TABLE extraction_failures ADD COLUMN failure_key TEXT;

CREATE UNIQUE INDEX extraction_failures_key
	ON extraction_failures (failure_key);
