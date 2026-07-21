import { parseJsonRecord, parseJsonStringArray } from "../../../core/json.ts";
import type { StoryComparison } from "../domain/story-comparison.ts";
import { COMPARISON_PIPELINE } from "../domain/pipeline.ts";
import { CURRENT_CAPTURE_MEMBERSHIPS_CTE } from "./analysis-run-repository.ts";

type PublicationEvidenceRow = {
	annotation_run_id: string;
	capture_id: string;
	captured_at: string;
	category: string | null;
	canonical_url: string | null;
	confidence: number;
	entities_json: string;
	framing_json: string;
	headline: string;
	normalised_label: string;
	placement_key: string;
	prominence: "lead" | "major" | "minor" | "standard" | null;
	rank: number;
	section: string | null;
	site: string;
	story_id: string;
	story_label: string;
	summary: string | null;
	topics_json: string;
};

export type StoryRevisionEvidence = {
	annotationRunId: string;
	captureId: string;
	capturedAt: string;
	category?: string;
	confidence: number;
	entities: string[];
	evidenceId: string;
	framing: Record<string, unknown>;
	headline: string;
	label: string;
	placementKey: string;
	prominence?: "lead" | "major" | "minor" | "standard";
	rank: number;
	section?: string;
	site: string;
	summary?: string;
	topics: string[];
	url?: string;
};

export type WindowStoryEvidence = {
	evidence: StoryRevisionEvidence[];
	label: string;
	storyId: string;
};

function revisionEvidence(
	row: PublicationEvidenceRow,
	evidenceId: string,
): StoryRevisionEvidence {
	return {
		annotationRunId: row.annotation_run_id,
		captureId: row.capture_id,
		capturedAt: row.captured_at,
		category: row.category ?? undefined,
		confidence: row.confidence,
		entities: parseJsonStringArray(row.entities_json),
		evidenceId,
		framing: parseJsonRecord(row.framing_json),
		headline: row.headline,
		label: row.normalised_label,
		placementKey: row.placement_key,
		prominence: row.prominence ?? undefined,
		rank: row.rank,
		section: row.section ?? undefined,
		site: row.site,
		summary: row.summary ?? undefined,
		topics: parseJsonStringArray(row.topics_json),
		url: row.canonical_url ?? undefined,
	};
}

export async function listWindowStoryEvidence(
	database: D1Database,
	cohortId: string,
	windowId: string,
): Promise<WindowStoryEvidence[]> {
	const rows = await database
		.prepare(
			`WITH ${CURRENT_CAPTURE_MEMBERSHIPS_CTE}
			SELECT
				sm.story_id, sm.annotation_run_id, sm.capture_id, sm.placement_key, sm.site,
				s.normalised_label AS story_label,
				ac.captured_at, ca.normalised_label, ca.topics_json, ca.entities_json,
				ca.framing_json, ca.confidence, pe.headline, pe.summary, pe.canonical_url,
				pe.category, pe.section, pe.prominence, pe.rank
			FROM comparison_window_sites cws
			JOIN current_memberships sm
				ON sm.capture_id = cws.capture_id AND sm.site = cws.site AND sm.active = 1
			JOIN comparison_stories s ON s.story_id = sm.story_id
			JOIN analysed_captures ac ON ac.capture_id = sm.capture_id
			JOIN content_annotations ca
				ON ca.run_id = sm.annotation_run_id
				AND ca.capture_id = sm.capture_id
				AND ca.placement_key = sm.placement_key
			JOIN page_elements pe
				ON pe.capture_id = sm.capture_id AND pe.placement_key = sm.placement_key
			WHERE cws.window_id = ? AND sm.cohort_id = ?
			ORDER BY sm.story_id, sm.site, pe.rank, sm.placement_key`,
		)
		.bind(windowId, cohortId)
		.all<PublicationEvidenceRow>();
	const stories = new Map<
		string,
		{ label: string; representatives: Map<string, PublicationEvidenceRow> }
	>();
	for (const row of rows.results) {
		const story = stories.get(row.story_id) ?? {
			label: row.story_label,
			representatives: new Map<string, PublicationEvidenceRow>(),
		};
		if (!story.representatives.has(row.site)) {
			story.representatives.set(row.site, row);
		}
		stories.set(row.story_id, story);
	}
	return [...stories]
		.map(([storyId, story]) => {
			const representatives = [...story.representatives.values()].sort(
				(left, right) => left.rank - right.rank || left.site.localeCompare(right.site),
			);
			return {
				evidence: representatives.map((row, index) =>
					revisionEvidence(row, `source-${index + 1}`),
				),
				label: story.label,
				storyId,
			};
		})
		.sort((left, right) => left.storyId.localeCompare(right.storyId));
}

function sharedTopics(evidence: readonly StoryRevisionEvidence[]): string[] {
	const sitesByTopic = new Map<string, Set<string>>();
	for (const item of evidence) {
		for (const topic of item.topics) {
			const sites = sitesByTopic.get(topic) ?? new Set<string>();
			sites.add(item.site);
			sitesByTopic.set(topic, sites);
		}
	}
	return [...sitesByTopic]
		.filter(([, sites]) => sites.size >= 2)
		.map(([topic]) => topic)
		.sort();
}

export async function saveStoryRevision(input: {
	analysis: {
		aiGatewayLogId: string | null;
		errorCode?: string;
		errorMessage?: string;
		inputR2Key: string;
		inputTokens?: number;
		outputR2Key: string;
		outputTokens?: number;
		status: "available" | "unavailable";
	};
	bucket: R2Bucket;
	cohortId: string;
	comparison: StoryComparison;
	database: D1Database;
	evidence: readonly StoryRevisionEvidence[];
	runId: string;
	storyId: string;
	windowId: string;
}): Promise<string> {
	const existing = await input.database
		.prepare(
			`SELECT revision_id FROM story_revisions
			WHERE run_id = ? AND window_id = ? AND analysis_status = ?
			ORDER BY created_at DESC LIMIT 1`,
		)
		.bind(input.runId, input.windowId, input.analysis.status)
		.first<{ revision_id: string }>();
	const now = new Date().toISOString();
	const runStatus = input.analysis.status === "available" ? "succeeded" : "failed";
	const runUpdate = input.database
		.prepare(
			`UPDATE analysis_runs SET
				status = ?, input_tokens = ?, output_tokens = ?, ai_gateway_log_id = ?,
				input_r2_key = ?, output_r2_key = ?, error_code = ?, error_message = ?,
				completed_at = ?
			WHERE run_id = ?`,
		)
		.bind(
			runStatus,
			input.analysis.inputTokens ?? null,
			input.analysis.outputTokens ?? null,
			input.analysis.aiGatewayLogId,
			input.analysis.inputR2Key,
			input.analysis.outputR2Key,
			input.analysis.errorCode ?? null,
			input.analysis.errorMessage?.slice(0, 20_000) ?? null,
			now,
			input.runId,
		);
	if (existing) {
		await input.database.batch([
			runUpdate,
			input.database
				.prepare("UPDATE comparison_stories SET current_revision_id = ? WHERE story_id = ?")
				.bind(existing.revision_id, input.storyId),
		]);
		return existing.revision_id;
	}

	const revisionId = crypto.randomUUID();
	const topics = sharedTopics(input.evidence);
	const document = {
		analysisStatus: input.analysis.status,
		cohortId: input.cohortId,
		commonGround: input.comparison.commonGround,
		confidence: input.comparison.confidence,
		differences: input.comparison.differences,
		evidence: input.evidence,
		generatedAt: now,
		pipelineVersion: COMPARISON_PIPELINE.pipelineVersion,
		revisionId,
		storyId: input.storyId,
		summary: input.comparison.summary,
		windowId: input.windowId,
	};
	const r2DocumentKey = `comparison/revisions/${revisionId}.json`;
	await input.bucket.put(r2DocumentKey, JSON.stringify(document), {
		httpMetadata: { contentType: "application/json" },
	});
	const sourceCount = new Set(input.evidence.map(({ site }) => site)).size;
	const statements: D1PreparedStatement[] = [
		runUpdate,
		input.database
			.prepare(
				`INSERT INTO story_revisions (
					revision_id, story_id, run_id, window_id, summary, common_ground_json,
					differences_json, confidence, source_count, left_source_count,
					centre_source_count, right_source_count, unrated_source_count,
					evidence_count, perspective_snapshot_json, r2_document_key,
					created_at, analysis_status
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, '[]', ?, ?, ?)`,
			)
			.bind(
				revisionId,
				input.storyId,
				input.runId,
				input.windowId,
				input.comparison.summary,
				JSON.stringify(input.comparison.commonGround),
				JSON.stringify(input.comparison.differences),
				input.comparison.confidence,
				sourceCount,
				sourceCount,
				input.evidence.length,
				r2DocumentKey,
				now,
				input.analysis.status,
			),
		input.database
			.prepare("UPDATE comparison_stories SET current_revision_id = ? WHERE story_id = ?")
			.bind(revisionId, input.storyId),
	];
	for (const item of input.evidence) {
		statements.push(
			input.database
				.prepare(
					`INSERT INTO story_revision_evidence (
						revision_id, evidence_id, annotation_run_id, capture_id,
						placement_key, site
					) VALUES (?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					revisionId,
					item.evidenceId,
					item.annotationRunId,
					item.captureId,
					item.placementKey,
					item.site,
				),
		);
	}
	for (const topic of topics) {
		statements.push(
			input.database
				.prepare("INSERT INTO story_topics (revision_id, story_id, topic) VALUES (?, ?, ?)")
				.bind(revisionId, input.storyId, topic),
		);
	}
	await input.database.batch(statements);
	return revisionId;
}
