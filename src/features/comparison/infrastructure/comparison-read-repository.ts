import { CURRENT_CAPTURE_MEMBERSHIPS_CTE } from "./analysis-run-repository.ts";

type StoryListRow = {
	analysis_status: "available" | "unavailable";
	confidence: number;
	last_seen_at: string;
	max_prominence: number;
	normalised_label: string;
	publishers: string;
	revision_id: string;
	slug: string;
	source_count: number;
	story_id: string;
	summary: string;
	topics: string | null;
	window_id: string;
};

export type ComparisonStoryCursor = {
	lastSeenAt: string;
	maxProminence: string;
	sourceCount: string;
	storyId: string;
};

type CoverageGapRow = {
	analysed_site_count: number;
	cluster_confidence: number;
	confidence: number;
	expected_site_count: number;
	last_seen_at: string;
	max_prominence: number;
	missing_publishers: string;
	normalised_label: string;
	publishers: string;
	revision_id: string;
	slug: string;
	source_count: number;
	story_id: string;
	window_id: string;
};

export async function listCoverageGaps(
	database: D1Database,
	options: {
		cohortId: string;
		cursor?: ComparisonStoryCursor;
		limit: number;
		minimumAnalysedSites: number;
		windowId?: string;
	},
) {
	const bindings: Array<number | string> = [
		options.cohortId,
		options.minimumAnalysedSites,
	];
	const windowCondition = options.windowId
		? "w.window_id = ?"
		: `w.window_id = (
			SELECT window_id FROM comparison_windows
			WHERE cohort_id = ? AND status IN ('complete', 'partial')
			ORDER BY starts_at DESC LIMIT 1
		)`;
	bindings.push(options.windowId ?? options.cohortId);

	const cursorCondition = options.cursor
		? `(
			r.source_count < ? OR
			(r.source_count = ? AND max_prominence < ?) OR
			(r.source_count = ? AND max_prominence = ? AND MAX(ac.captured_at) < ?) OR
			(r.source_count = ? AND max_prominence = ? AND MAX(ac.captured_at) = ? AND s.story_id < ?)
		)`
		: "1 = 1";
	if (options.cursor) {
		const sourceCount = Number(options.cursor.sourceCount);
		const maxProminence = Number(options.cursor.maxProminence);
		bindings.push(
			sourceCount,
			sourceCount,
			maxProminence,
			sourceCount,
			maxProminence,
			options.cursor.lastSeenAt,
			sourceCount,
			maxProminence,
			options.cursor.lastSeenAt,
			options.cursor.storyId,
		);
	}
	bindings.push(options.limit + 1);

	const rows = await database
		.prepare(
			`WITH latest_revisions AS (
				SELECT
					r.*,
					ROW_NUMBER() OVER (
						PARTITION BY r.story_id, r.window_id
						ORDER BY r.created_at DESC, r.revision_id DESC
					) AS revision_position
				FROM story_revisions r
				JOIN analysis_runs revision_run ON revision_run.run_id = r.run_id
				WHERE r.withdrawn_at IS NULL
					AND revision_run.pipeline_version = (
						SELECT MAX(candidate_run.pipeline_version)
						FROM story_revisions candidate_revision
						JOIN analysis_runs candidate_run
							ON candidate_run.run_id = candidate_revision.run_id
						WHERE candidate_revision.window_id = r.window_id
							AND candidate_revision.withdrawn_at IS NULL
					)
			)
			SELECT
				s.story_id, s.slug, s.normalised_label, r.revision_id, r.window_id,
				r.source_count, r.confidence, w.expected_site_count, w.analysed_site_count,
				MIN(ca.confidence) AS cluster_confidence,
				MAX(ac.captured_at) AS last_seen_at,
				GROUP_CONCAT(DISTINCT e.site) AS publishers,
				GROUP_CONCAT(DISTINCT missing.site) AS missing_publishers,
				MAX(CASE pe.prominence
					WHEN 'lead' THEN 4 WHEN 'major' THEN 3 WHEN 'standard' THEN 2
					WHEN 'minor' THEN 1 ELSE 0 END) AS max_prominence
			FROM comparison_stories s
			JOIN latest_revisions r ON r.story_id = s.story_id AND r.revision_position = 1
			JOIN comparison_windows w ON w.window_id = r.window_id
			JOIN story_revision_evidence e ON e.revision_id = r.revision_id
			JOIN content_annotations ca
				ON ca.run_id = e.annotation_run_id
				AND ca.capture_id = e.capture_id
				AND ca.placement_key = e.placement_key
			JOIN analysed_captures ac ON ac.capture_id = e.capture_id
			JOIN page_elements pe
				ON pe.capture_id = e.capture_id AND pe.placement_key = e.placement_key
			JOIN comparison_window_sites missing
				ON missing.window_id = w.window_id
				AND missing.status = 'analysed'
				AND NOT EXISTS (
					SELECT 1 FROM story_revision_evidence observed
					WHERE observed.revision_id = r.revision_id AND observed.site = missing.site
				)
			WHERE w.cohort_id = ?
				AND w.analysed_site_count >= ?
				AND w.status IN ('complete', 'partial')
				AND ${windowCondition}
				AND r.analysis_status = 'available'
				AND r.source_count >= 3
				AND r.confidence >= 0.85
			GROUP BY s.story_id, r.revision_id
			HAVING max_prominence >= 3 AND cluster_confidence >= 0.85
				AND ${cursorCondition}
			ORDER BY r.source_count DESC, max_prominence DESC, last_seen_at DESC, s.story_id DESC
			LIMIT ?`,
		)
		.bind(...bindings)
		.all<CoverageGapRow>();
	const page = rows.results.slice(0, options.limit);
	const last = page.at(-1);

	return {
		gaps: page.map((row) => ({
			analysedSites: row.analysed_site_count,
			clusterConfidence: row.cluster_confidence,
			confidence: row.confidence,
			expectedSites: row.expected_site_count,
			label: row.normalised_label,
			lastSeenAt: row.last_seen_at,
			maxProminence: row.max_prominence,
			missingPublishers: row.missing_publishers.split(",").sort(),
			publishers: row.publishers.split(",").sort(),
			revisionId: row.revision_id,
			slug: row.slug,
			sourceCount: row.source_count,
			storyId: row.story_id,
			windowId: row.window_id,
		})),
		nextCursor:
			rows.results.length > options.limit && last
				? {
						lastSeenAt: last.last_seen_at,
						maxProminence: String(last.max_prominence),
						sourceCount: String(last.source_count),
						storyId: last.story_id,
					}
				: undefined,
	};
}

export async function listComparisonStories(
	database: D1Database,
	options: {
		cohortId: string;
		cursor?: ComparisonStoryCursor;
		from?: string;
		limit: number;
		publisher?: string;
		topic?: string;
		to?: string;
		windowId?: string;
	},
) {
	const scopeConditions = [
		"w.cohort_id = ?",
		"r.withdrawn_at IS NULL",
		"w.status IN ('complete', 'partial')",
	];
	const bindings: Array<number | string> = [options.cohortId];
	if (options.windowId) {
		scopeConditions.push("r.window_id = ?");
		bindings.push(options.windowId);
	} else if (options.from && options.to) {
		scopeConditions.push("w.starts_at >= ? AND w.starts_at < ?");
		bindings.push(options.from, options.to);
	} else {
		scopeConditions.push(
			`r.window_id = (
				SELECT window_id FROM comparison_windows
				WHERE cohort_id = ? AND status IN ('complete', 'partial')
				ORDER BY starts_at DESC LIMIT 1
			)`,
		);
		bindings.push(options.cohortId);
	}
	const conditions = ["s.cohort_id = ?", "r.revision_position = 1"];
	bindings.push(options.cohortId);
	if (options.topic) {
		conditions.push(
			"EXISTS (SELECT 1 FROM story_topics st WHERE st.revision_id = r.revision_id AND st.topic = ?)",
		);
		bindings.push(options.topic);
	}
	if (options.publisher) {
		conditions.push(
			`EXISTS (
				SELECT 1 FROM story_revision_evidence pre
				WHERE pre.revision_id = r.revision_id AND pre.site = ?
			)`,
		);
		bindings.push(options.publisher);
	}
	const having = options.cursor
		? `HAVING (
			r.source_count < ? OR
			(r.source_count = ? AND max_prominence < ?) OR
			(r.source_count = ? AND max_prominence = ? AND MAX(ac.captured_at) < ?) OR
			(r.source_count = ? AND max_prominence = ? AND MAX(ac.captured_at) = ? AND s.story_id < ?)
		)`
		: "";
	if (options.cursor) {
		const sourceCount = Number(options.cursor.sourceCount);
		const maxProminence = Number(options.cursor.maxProminence);
		bindings.push(
			sourceCount,
			sourceCount,
			maxProminence,
			sourceCount,
			maxProminence,
			options.cursor.lastSeenAt,
			sourceCount,
			maxProminence,
			options.cursor.lastSeenAt,
			options.cursor.storyId,
		);
	}
	bindings.push(options.limit + 1);
	const rows = await database
		.prepare(
			`WITH scoped_revisions AS (
				SELECT
					r.*,
					ROW_NUMBER() OVER (
						PARTITION BY r.story_id
						ORDER BY w.starts_at DESC, r.created_at DESC, r.revision_id DESC
					) AS revision_position
				FROM story_revisions r
				JOIN analysis_runs revision_run ON revision_run.run_id = r.run_id
				JOIN comparison_windows w ON w.window_id = r.window_id
				WHERE ${scopeConditions.join(" AND ")}
					AND revision_run.pipeline_version = (
						SELECT MAX(candidate_run.pipeline_version)
						FROM story_revisions candidate_revision
						JOIN analysis_runs candidate_run
							ON candidate_run.run_id = candidate_revision.run_id
						WHERE candidate_revision.window_id = r.window_id
							AND candidate_revision.withdrawn_at IS NULL
					)
			)
			SELECT
				s.story_id, s.slug, s.normalised_label, MAX(ac.captured_at) AS last_seen_at,
				r.revision_id, r.window_id, r.source_count, r.confidence, r.summary,
				r.analysis_status,
				GROUP_CONCAT(DISTINCT e.site) AS publishers,
				GROUP_CONCAT(DISTINCT st.topic) AS topics,
				MAX(CASE pe.prominence
					WHEN 'lead' THEN 4 WHEN 'major' THEN 3 WHEN 'standard' THEN 2
					WHEN 'minor' THEN 1 ELSE 0 END) AS max_prominence
			FROM comparison_stories s
			JOIN scoped_revisions r ON r.story_id = s.story_id
			JOIN story_revision_evidence e ON e.revision_id = r.revision_id
			JOIN analysed_captures ac ON ac.capture_id = e.capture_id
			JOIN page_elements pe ON pe.capture_id = e.capture_id AND pe.placement_key = e.placement_key
			LEFT JOIN story_topics st ON st.revision_id = r.revision_id
			WHERE ${conditions.join(" AND ")}
			GROUP BY s.story_id, r.revision_id
			${having}
			ORDER BY r.source_count DESC, max_prominence DESC, last_seen_at DESC, s.story_id DESC
			LIMIT ?`,
		)
		.bind(...bindings)
		.all<StoryListRow>();
	const page = rows.results.slice(0, options.limit);
	const last = page.at(-1);
	return {
		nextCursor:
			rows.results.length > options.limit && last
				? {
						lastSeenAt: last.last_seen_at,
						maxProminence: String(last.max_prominence),
						sourceCount: String(last.source_count),
						storyId: last.story_id,
					}
				: undefined,
		stories: page.map((row) => ({
			analysisStatus: row.analysis_status,
			confidence: row.confidence,
			label: row.normalised_label,
			lastSeenAt: row.last_seen_at,
			maxProminence: row.max_prominence,
			publishers: row.publishers.split(",").sort(),
			revisionId: row.revision_id,
			slug: row.slug,
			sourceCount: row.source_count,
			storyId: row.story_id,
			summary: row.summary,
			topics: row.topics ? row.topics.split(",").sort() : [],
			windowId: row.window_id,
		})),
	};
}

type StoryEvidenceRow = {
	capture_id: string;
	captured_at: string;
	category: string | null;
	canonical_url: string | null;
	evidence_id: string;
	headline: string;
	last_seen_at: string;
	placement_key: string;
	prominence: string | null;
	rank: number;
	section: string | null;
	site: string;
	summary: string | null;
};

type StoryRevisionRow = {
	analysis_status: "available" | "unavailable";
	analysed_site_count: number;
	captured_site_count: number;
	cohort_id: string;
	common_ground_json: string;
	confidence: number;
	created_at: string;
	differences_json: string;
	ends_at: string;
	evidence_count: number;
	expected_site_count: number;
	first_seen_at: string;
	last_seen_at: string;
	normalised_label: string;
	revision_id: string;
	slug: string;
	source_count: number;
	starts_at: string;
	story_id: string;
	summary: string;
	window_id: string;
	window_status: string;
};

export async function getComparisonStory(
	database: D1Database,
	storyId: string,
	revisionId?: string,
) {
	const revision = await database
		.prepare(
			`SELECT
				s.story_id, s.slug, s.normalised_label, s.first_seen_at, s.last_seen_at,
				r.revision_id, r.window_id, r.summary, r.common_ground_json,
				r.differences_json, r.confidence, r.source_count, r.evidence_count,
				r.created_at, r.analysis_status,
				w.cohort_id, w.starts_at, w.ends_at, w.expected_site_count,
				w.captured_site_count, w.analysed_site_count, w.status AS window_status
			FROM comparison_stories s
			JOIN story_revisions r
				ON r.story_id = s.story_id
				AND r.revision_id = COALESCE(?, s.current_revision_id)
			JOIN comparison_windows w ON w.window_id = r.window_id
			WHERE s.story_id = ? AND r.withdrawn_at IS NULL`,
		)
		.bind(revisionId ?? null, storyId)
		.first<StoryRevisionRow>();
	if (!revision) {
		return null;
	}
	const evidence = await database
		.prepare(
			`SELECT
				e.evidence_id, e.capture_id, e.placement_key, e.site,
				ac.captured_at, pe.headline, pe.summary, pe.canonical_url, pe.category,
				pe.section, pe.prominence, pe.rank,
				(SELECT MAX(ac2.captured_at)
				 FROM story_memberships sm2
				 JOIN analysed_captures ac2 ON ac2.capture_id = sm2.capture_id
				 WHERE sm2.story_id = ? AND sm2.site = e.site AND sm2.active = 1) AS last_seen_at
			FROM story_revision_evidence e
			JOIN analysed_captures ac ON ac.capture_id = e.capture_id
			JOIN page_elements pe ON pe.capture_id = e.capture_id AND pe.placement_key = e.placement_key
			WHERE e.revision_id = ?
			ORDER BY pe.rank, e.site`,
		)
		.bind(storyId, revision.revision_id)
		.all<StoryEvidenceRow>();
	return { evidence: evidence.results, revision };
}

type TopicAggregateRow = {
	cohort_count: number;
	publisher_count: number;
	topic: string;
};

type PublisherSummaryRow = {
	cohort_observation_count: number;
	lead_count: number;
	observation_count: number;
	weighted_prominence_hours: number;
};

type TimingRow = {
	label: string;
	peer_first_seen_at: string;
	publisher_capture_id: string;
	publisher_first_seen_at: string;
	story_id: string;
};

type LeadObservationRow = {
	capture_id: string;
	captured_at: string;
	headline: string;
	label: string;
	story_id: string;
};

function leadStoryChanges(rows: readonly LeadObservationRow[]) {
	const changes: LeadObservationRow[] = [];
	let previousStoryId: string | undefined;

	for (const row of rows) {
		if (row.story_id !== previousStoryId) {
			changes.push(row);
			previousStoryId = row.story_id;
		}
	}

	return changes.reverse().slice(0, 50).map((row) => ({
		captureId: row.capture_id,
		capturedAt: row.captured_at,
		headline: row.headline,
		label: row.label,
		storyId: row.story_id,
	}));
}

function leadHeadlineChanges(rows: readonly LeadObservationRow[]) {
	const changes: LeadObservationRow[] = [];
	let previousHeadline: string | undefined;

	for (const row of rows) {
		const headline = row.headline.trim().toLocaleLowerCase("en-GB");
		if (headline !== previousHeadline) {
			changes.push(row);
			previousHeadline = headline;
		}
	}

	return changes.reverse().slice(0, 50).map((row) => ({
		captureId: row.capture_id,
		capturedAt: row.captured_at,
		headline: row.headline,
		storyId: row.story_id,
	}));
}

export async function getPublisherComparison(
	database: D1Database,
	input: { cohortId: string; from: string; site: string; to: string },
) {
	const summary = await database
		.prepare(
			`WITH ${CURRENT_CAPTURE_MEMBERSHIPS_CTE}
			SELECT
				SUM(CASE WHEN sm.site = ? THEN 1 ELSE 0 END) AS observation_count,
				COUNT(*) AS cohort_observation_count,
				SUM(CASE WHEN sm.site = ? AND pe.prominence = 'lead' THEN 1 ELSE 0 END)
					AS lead_count,
				SUM(
					CASE WHEN sm.site = ? THEN (CASE pe.prominence
						WHEN 'lead' THEN 4 WHEN 'major' THEN 3 WHEN 'standard' THEN 2
						WHEN 'minor' THEN 1 ELSE 0 END) *
						((julianday(w.ends_at) - julianday(w.starts_at)) * 24)
					ELSE 0 END
				) AS weighted_prominence_hours
			FROM current_memberships sm
			JOIN comparison_window_sites cws
				ON cws.capture_id = sm.capture_id AND cws.site = sm.site
				AND cws.status = 'analysed'
			JOIN comparison_windows w ON w.window_id = cws.window_id
			JOIN page_elements pe
				ON pe.capture_id = sm.capture_id AND pe.placement_key = sm.placement_key
			WHERE w.cohort_id = ? AND w.starts_at >= ? AND w.starts_at < ?
				AND w.status IN ('complete', 'partial')
				AND sm.cohort_id = ?`,
		)
		.bind(
			input.site,
			input.site,
			input.site,
			input.cohortId,
			input.from,
			input.to,
			input.cohortId,
		)
		.first<PublisherSummaryRow>();
	const topics = await database
		.prepare(
			`WITH ${CURRENT_CAPTURE_MEMBERSHIPS_CTE}
			SELECT
				CAST(topic.value AS TEXT) AS topic,
				COUNT(DISTINCT CASE WHEN sm.site = ?
					THEN sm.capture_id || ':' || sm.placement_key END) AS publisher_count,
				COUNT(DISTINCT sm.capture_id || ':' || sm.placement_key) AS cohort_count
			FROM current_memberships sm
			JOIN comparison_window_sites cws
				ON cws.capture_id = sm.capture_id AND cws.site = sm.site
				AND cws.status = 'analysed'
			JOIN comparison_windows w ON w.window_id = cws.window_id
			JOIN content_annotations ca
				ON ca.run_id = sm.annotation_run_id
				AND ca.capture_id = sm.capture_id
				AND ca.placement_key = sm.placement_key
			JOIN json_each(ca.topics_json) topic
			WHERE w.cohort_id = ? AND w.starts_at >= ? AND w.starts_at < ?
				AND w.status IN ('complete', 'partial')
				AND sm.cohort_id = ?
			GROUP BY topic.value
			HAVING publisher_count > 0
			ORDER BY publisher_count DESC, topic
			LIMIT 30`,
		)
		.bind(input.site, input.cohortId, input.from, input.to, input.cohortId)
		.all<TopicAggregateRow>();
	const timings = await database
		.prepare(
			`WITH ${CURRENT_CAPTURE_MEMBERSHIPS_CTE},
			first_seen AS (
				SELECT
					sm.story_id,
					MIN(CASE WHEN sm.site = ? THEN ac.captured_at END) AS publisher_first_seen_at,
					MIN(CASE WHEN sm.site != ? THEN ac.captured_at END) AS peer_first_seen_at
				FROM current_memberships sm
				JOIN analysed_captures ac ON ac.capture_id = sm.capture_id
				JOIN comparison_window_sites cws
					ON cws.capture_id = sm.capture_id AND cws.site = sm.site
					AND cws.status = 'analysed'
				JOIN comparison_windows w ON w.window_id = cws.window_id
				WHERE sm.cohort_id = ? AND w.status IN ('complete', 'partial')
					AND w.starts_at >= ? AND w.starts_at < ?
				GROUP BY sm.story_id
			)
			SELECT
				fs.story_id, fs.publisher_first_seen_at, fs.peer_first_seen_at,
				s.normalised_label AS label,
				(SELECT sm2.capture_id
				 FROM current_memberships sm2
				 JOIN analysed_captures ac2 ON ac2.capture_id = sm2.capture_id
				 JOIN comparison_window_sites cws2
					ON cws2.capture_id = sm2.capture_id AND cws2.site = sm2.site
					AND cws2.status = 'analysed'
				 JOIN comparison_windows w2 ON w2.window_id = cws2.window_id
				 WHERE sm2.story_id = fs.story_id AND sm2.site = ?
					AND w2.status IN ('complete', 'partial')
					AND w2.starts_at >= ? AND w2.starts_at < ?
				 ORDER BY ac2.captured_at LIMIT 1) AS publisher_capture_id
			FROM first_seen fs
			JOIN comparison_stories s ON s.story_id = fs.story_id
			WHERE fs.publisher_first_seen_at IS NOT NULL AND fs.peer_first_seen_at IS NOT NULL
			ORDER BY ABS(
				strftime('%s', fs.publisher_first_seen_at) -
				strftime('%s', fs.peer_first_seen_at)
			) DESC
			LIMIT 20`,
		)
		.bind(
			input.site,
			input.site,
			input.cohortId,
			input.from,
			input.to,
			input.site,
			input.from,
			input.to,
		)
		.all<TimingRow>();
	const leadObservations = await database
		.prepare(
			`WITH ${CURRENT_CAPTURE_MEMBERSHIPS_CTE},
			ranked_leads AS (
				SELECT
					sm.story_id, sm.capture_id, ac.captured_at, pe.headline,
					s.normalised_label AS label,
					ROW_NUMBER() OVER (
						PARTITION BY sm.capture_id
						ORDER BY pe.rank, sm.placement_key, sm.story_id
					) AS lead_position
				FROM current_memberships sm
				JOIN comparison_stories s ON s.story_id = sm.story_id
				JOIN analysed_captures ac ON ac.capture_id = sm.capture_id
				JOIN comparison_window_sites cws
					ON cws.capture_id = sm.capture_id AND cws.site = sm.site
					AND cws.status = 'analysed'
				JOIN comparison_windows w ON w.window_id = cws.window_id
				JOIN page_elements pe
					ON pe.capture_id = sm.capture_id AND pe.placement_key = sm.placement_key
				WHERE sm.cohort_id = ? AND sm.site = ?
					AND w.status IN ('complete', 'partial')
					AND w.starts_at >= ? AND w.starts_at < ?
					AND pe.prominence = 'lead'
			)
			SELECT story_id, capture_id, captured_at, headline, label
			FROM ranked_leads
			WHERE lead_position = 1
			ORDER BY captured_at, capture_id
			LIMIT 3000`,
		)
		.bind(input.cohortId, input.site, input.from, input.to)
		.all<LeadObservationRow>();
	const observationCount = summary?.observation_count ?? 0;
	return {
		cohortObservationCount: summary?.cohort_observation_count ?? 0,
		from: input.from,
		headlineTimeline: leadHeadlineChanges(leadObservations.results),
		leadCount: summary?.lead_count ?? 0,
		leadTimeline: leadStoryChanges(leadObservations.results),
		observationCount,
		timings: timings.results.map((row) => ({
			captureId: row.publisher_capture_id,
			direction:
				Date.parse(row.publisher_first_seen_at) < Date.parse(row.peer_first_seen_at)
					? "earlier"
					: Date.parse(row.publisher_first_seen_at) > Date.parse(row.peer_first_seen_at)
						? "later"
						: "same-window",
			label: row.label,
			peerFirstSeenAt: row.peer_first_seen_at,
			publisherFirstSeenAt: row.publisher_first_seen_at,
			storyId: row.story_id,
		})),
		to: input.to,
		topics: topics.results.map((row) => ({
			cohortObservationCount: row.cohort_count,
			publisherShare: observationCount === 0 ? 0 : row.publisher_count / observationCount,
			publisherObservationCount: row.publisher_count,
			topic: row.topic,
		})),
		weightedProminenceHours: summary?.weighted_prominence_hours ?? 0,
	};
}
