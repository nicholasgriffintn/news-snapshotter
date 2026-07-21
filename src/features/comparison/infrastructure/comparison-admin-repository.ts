import { ANALYSIS_STALE_AFTER_MS } from "../domain/pipeline.ts";

export async function recordComparisonFeedback(
	database: D1Database,
	input: {
		evidenceId?: string;
		note?: string;
		reason: "incorrect" | "missing-context" | "other" | "unsupported";
		revisionId: string;
	},
): Promise<string | null> {
	const revision = await database
		.prepare("SELECT revision_id FROM story_revisions WHERE revision_id = ?")
		.bind(input.revisionId)
		.first<{ revision_id: string }>();
	if (!revision) {
		return null;
	}
	if (input.evidenceId) {
		const evidence = await database
			.prepare(
				`SELECT evidence_id FROM story_revision_evidence
				WHERE revision_id = ? AND evidence_id = ?`,
			)
			.bind(input.revisionId, input.evidenceId)
			.first<{ evidence_id: string }>();
		if (!evidence) {
			return null;
		}
	}
	const feedbackId = crypto.randomUUID();
	await database
		.prepare(
			`INSERT INTO analysis_feedback (
				feedback_id, revision_id, evidence_id, reason, note, submitted_at
			) VALUES (?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			feedbackId,
			input.revisionId,
			input.evidenceId ?? null,
			input.reason,
			input.note ?? null,
			new Date().toISOString(),
		)
		.run();
	return feedbackId;
}

export async function listAnalysisRuns(
	database: D1Database,
	options: { limit: number; status?: string },
) {
	let where = "";
	const bindings: Array<number | string> = [];

	if (options.status === "stale") {
		where =
			"WHERE r.status IN ('pending', 'running') AND COALESCE(r.started_at, r.created_at) < ?";
		bindings.push(new Date(Date.now() - ANALYSIS_STALE_AFTER_MS).toISOString());
	} else if (options.status) {
		where = "WHERE r.status = ?";
		bindings.push(options.status);
	}

	bindings.push(options.limit);
	const rows = await database
		.prepare(
			`SELECT
				r.run_id, r.kind, r.capture_id, r.story_id, r.window_id, r.model, r.status,
				r.attempt_count, ac.site, ac.triggered_at,
				input_tokens, output_tokens, ai_gateway_log_id, error_code, error_message,
				created_at, started_at, completed_at
			FROM analysis_runs r
			LEFT JOIN analysed_captures ac ON ac.capture_id = r.capture_id
			${where}
			ORDER BY r.created_at DESC, r.run_id DESC
			LIMIT ?`,
		)
		.bind(...bindings)
		.all<Record<string, number | string | null>>();
	return rows.results;
}

export async function captureAnalysisIdentities(
	database: D1Database,
	captureIds: readonly string[],
): Promise<
	Array<{
		captureId: string;
		contentHash: string;
		site: string;
		triggeredAt: string;
	}>
> {
	if (captureIds.length === 0) {
		return [];
	}

	const placeholders = captureIds.map(() => "?").join(", ");
	const rows = await database
		.prepare(
			`SELECT capture_id, content_hash, site, triggered_at FROM analysed_captures
			WHERE capture_id IN (${placeholders})`,
		)
		.bind(...captureIds)
		.all<{
			capture_id: string;
			content_hash: string;
			site: string;
			triggered_at: string;
		}>();
	const identityByCapture = new Map(
		rows.results.map((row) => [
			row.capture_id,
			{
				captureId: row.capture_id,
				contentHash: row.content_hash,
				site: row.site,
				triggeredAt: row.triggered_at,
			},
		]),
	);

	return captureIds.flatMap((captureId) => {
		const identity = identityByCapture.get(captureId);
		return identity ? [identity] : [];
	});
}

export async function withdrawStoryRevision(
	database: D1Database,
	revisionId: string,
	reason: string,
): Promise<boolean> {
	const revision = await database
		.prepare("SELECT story_id FROM story_revisions WHERE revision_id = ? AND withdrawn_at IS NULL")
		.bind(revisionId)
		.first<{ story_id: string }>();
	if (!revision) {
		return false;
	}
	await database.batch([
		database
			.prepare(
				`UPDATE story_revisions SET withdrawn_at = ?, withdrawal_reason = ?
				WHERE revision_id = ? AND withdrawn_at IS NULL`,
			)
			.bind(new Date().toISOString(), reason, revisionId),
		database
			.prepare(
				`UPDATE comparison_stories SET current_revision_id = (
					SELECT revision_id FROM story_revisions
					WHERE story_id = ? AND withdrawn_at IS NULL
					ORDER BY created_at DESC, revision_id DESC
					LIMIT 1
				)
				WHERE story_id = ? AND current_revision_id = ?`,
			)
			.bind(revision.story_id, revision.story_id, revisionId),
	]);
	return true;
}

export async function listAnalysisFeedback(
	database: D1Database,
	options: { limit: number; status: string },
) {
	const rows = await database
		.prepare(
			`SELECT
				af.feedback_id, af.revision_id, af.evidence_id, af.reason, af.note,
				af.submitted_at, af.review_status, af.resolution, af.resolved_at,
				r.story_id, s.normalised_label
			FROM analysis_feedback af
			JOIN story_revisions r ON r.revision_id = af.revision_id
			JOIN comparison_stories s ON s.story_id = r.story_id
			WHERE af.review_status = ?
			ORDER BY af.submitted_at DESC, af.feedback_id DESC
			LIMIT ?`,
		)
		.bind(options.status, options.limit)
		.all<Record<string, string | null>>();
	return rows.results;
}

export async function resolveAnalysisFeedback(
	database: D1Database,
	feedbackId: string,
	input: { resolution: string; status: "dismissed" | "resolved" },
): Promise<boolean> {
	const result = await database
		.prepare(
			`UPDATE analysis_feedback SET
				review_status = ?, resolution = ?, resolved_at = ?
			WHERE feedback_id = ? AND review_status = 'pending'`,
		)
		.bind(input.status, input.resolution, new Date().toISOString(), feedbackId)
		.run();
	return (result.meta.changes ?? 0) > 0;
}
