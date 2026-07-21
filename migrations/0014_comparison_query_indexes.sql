CREATE INDEX analysis_runs_capture_pipeline
	ON analysis_runs (
		capture_id, kind, status, pipeline_version DESC, completed_at DESC, run_id DESC
	);

CREATE INDEX story_revisions_window
	ON story_revisions (window_id, withdrawn_at, run_id, created_at DESC, revision_id);
