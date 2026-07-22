CREATE TABLE history_monthly_aggregate_runs (
	site TEXT NOT NULL,
	month TEXT NOT NULL,
	generated_at TEXT NOT NULL,
	PRIMARY KEY (site, month)
);

INSERT INTO history_monthly_aggregate_runs (site, month, generated_at)
SELECT site, month, MAX(generated_at)
FROM history_monthly_aggregates
GROUP BY site, month;
