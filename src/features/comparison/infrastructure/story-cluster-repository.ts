import { sha256 } from "../../../core/hash.ts";
import { parseJsonStringArray } from "../../../core/json.ts";
import {
	canJoinRecentStory,
	canJoinStory,
	storyLabelSimilarity,
	storySlug,
} from "../domain/clustering.ts";
import { COMPARISON_PIPELINE } from "../domain/pipeline.ts";
import type { CaptureAnnotation } from "../domain/annotation.ts";

type ClusterCandidate = {
	capturedAt: string;
	entities: string[];
	label: string;
	score: number;
	storyId: string;
};

async function clusterCandidate(
	database: D1Database,
	cohortId: string,
	match: VectorizeMatch,
): Promise<ClusterCandidate | null> {
	const row = await database
		.prepare(
			`SELECT
				ca.normalised_label, ca.entities_json, ac.captured_at, sm.story_id
			FROM content_annotations ca
			JOIN analysed_captures ac ON ac.capture_id = ca.capture_id
			JOIN story_memberships sm
				ON sm.annotation_run_id = ca.run_id
				AND sm.capture_id = ca.capture_id
				AND sm.placement_key = ca.placement_key
			WHERE ca.embedding_id = ? AND sm.cohort_id = ? AND sm.active = 1
				AND sm.pipeline_version = ?
			LIMIT 1`,
		)
		.bind(match.id, cohortId, COMPARISON_PIPELINE.pipelineVersion)
		.first<{
			captured_at: string;
			entities_json: string;
			normalised_label: string;
			story_id: string;
		}>();
	if (!row) {
		return null;
	}
	const entities = parseJsonStringArray(row.entities_json);
	return {
		capturedAt: row.captured_at,
		entities,
		label: row.normalised_label,
		score: match.score,
		storyId: row.story_id,
	};
}

async function attachStoryMembership(
	database: D1Database,
	input: {
		annotationRunId: string;
		captureId: string;
		capturedAt: string;
		cohortId: string;
		label: string;
		placementKey: string;
		reason?: "embedding-and-semantic-overlap" | "recent-label-and-entity-overlap";
		similarity?: number;
		site: string;
		storyId: string;
	},
	createStory: boolean,
): Promise<void> {
	const statements: D1PreparedStatement[] = [];
	if (createStory) {
		statements.push(
			database
				.prepare(
					`INSERT INTO comparison_stories (
						story_id, cohort_id, slug, normalised_label, first_seen_at, last_seen_at, status
					) VALUES (?, ?, ?, ?, ?, ?, 'open')`,
				)
				.bind(
					input.storyId,
					input.cohortId,
					storySlug(input.label, input.storyId),
					input.label,
					input.capturedAt,
					input.capturedAt,
				),
		);
	} else {
		statements.push(
			database
				.prepare(
					`UPDATE comparison_stories
					SET first_seen_at = MIN(first_seen_at, ?), last_seen_at = MAX(last_seen_at, ?)
					WHERE story_id = ? AND cohort_id = ?`,
				)
				.bind(input.capturedAt, input.capturedAt, input.storyId, input.cohortId),
		);
	}
	statements.push(
		database
			.prepare(
				`UPDATE story_memberships SET active = 0
				WHERE cohort_id = ? AND capture_id = ? AND placement_key = ?
					AND pipeline_version = ? AND active = 1`,
			)
			.bind(
				input.cohortId,
				input.captureId,
				input.placementKey,
				COMPARISON_PIPELINE.pipelineVersion,
			),
	);
	statements.push(
		database
			.prepare(
				`INSERT INTO story_memberships (
					story_id, cohort_id, capture_id, placement_key, annotation_run_id, site, pipeline_version,
					embedding_similarity, membership_reason, created_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(story_id, capture_id, placement_key, pipeline_version) DO UPDATE SET
					annotation_run_id = excluded.annotation_run_id,
					site = excluded.site,
					embedding_similarity = excluded.embedding_similarity,
					verifier_confidence = NULL,
					membership_reason = excluded.membership_reason,
					active = 1,
					created_at = excluded.created_at`,
			)
			.bind(
				input.storyId,
				input.cohortId,
				input.captureId,
				input.placementKey,
				input.annotationRunId,
				input.site,
				COMPARISON_PIPELINE.pipelineVersion,
				input.similarity ?? null,
				createStory ? "new-story" : input.reason,
				new Date().toISOString(),
			),
	);
	await database.batch(statements);
}

type ClusterCaptureInput = {
	annotation: CaptureAnnotation;
	captureId: string;
	capturedAt: string;
	cohortId: string;
	database: D1Database;
	embeddings: readonly number[][];
	language: string;
	placementByEvidenceId: ReadonlyMap<string, string>;
	runId: string;
	site: string;
	vectors: VectorizeIndex;
};

async function recentClusterCandidates(input: ClusterCaptureInput): Promise<ClusterCandidate[]> {
	const capturedAt = Date.parse(input.capturedAt);
	const from = new Date(capturedAt - 36 * 60 * 60 * 1_000).toISOString();
	const to = new Date(capturedAt + 36 * 60 * 60 * 1_000).toISOString();
	const rows = await input.database
		.prepare(
			`SELECT
				ca.normalised_label, ca.entities_json, ac.captured_at, sm.story_id
			FROM story_memberships sm
			JOIN content_annotations ca
				ON ca.run_id = sm.annotation_run_id
				AND ca.capture_id = sm.capture_id
				AND ca.placement_key = sm.placement_key
			JOIN analysed_captures ac ON ac.capture_id = sm.capture_id
			WHERE sm.cohort_id = ? AND sm.site != ? AND sm.active = 1
				AND sm.pipeline_version = ?
				AND ac.captured_at >= ? AND ac.captured_at <= ?
			ORDER BY ac.captured_at DESC, sm.story_id
			LIMIT 500`,
		)
		.bind(input.cohortId, input.site, COMPARISON_PIPELINE.pipelineVersion, from, to)
		.all<{
			captured_at: string;
			entities_json: string;
			normalised_label: string;
			story_id: string;
		}>();

	return rows.results.map((row) => ({
		capturedAt: row.captured_at,
		entities: parseJsonStringArray(row.entities_json),
		label: row.normalised_label,
		score: 0,
		storyId: row.story_id,
	}));
}

type ClusteredAnnotation = {
	embeddingUpdate: D1PreparedStatement;
	vector: VectorizeVector;
};

async function clusterAnnotation(
	input: ClusterCaptureInput,
	recentCandidates: readonly ClusterCandidate[],
	item: CaptureAnnotation["annotations"][number],
	index: number,
): Promise<ClusteredAnnotation> {
	const embedding = input.embeddings[index];
	const placementKey = input.placementByEvidenceId.get(item.evidenceId);
	if (!embedding || !placementKey) {
		throw new Error(`Embedding binding not found: ${item.evidenceId}`);
	}
	const capturedEpoch = Date.parse(input.capturedAt);
	const existing = await input.database
		.prepare(
			`SELECT story_id FROM story_memberships
			WHERE annotation_run_id = ? AND capture_id = ? AND placement_key = ?
				AND cohort_id = ? AND active = 1`,
		)
		.bind(input.runId, input.captureId, placementKey, input.cohortId)
		.first<{ story_id: string }>();

	if (!existing) {
		const recentCandidate = recentCandidates
			.filter((candidate) =>
				canJoinRecentStory({
					candidateCapturedAt: candidate.capturedAt,
					candidateEntities: candidate.entities,
					candidateLabel: candidate.label,
					capturedAt: input.capturedAt,
					entities: item.entities,
					label: item.normalisedLabel,
				}),
			)
			.sort(
				(left, right) =>
					storyLabelSimilarity(item.normalisedLabel, right.label) -
					storyLabelSimilarity(item.normalisedLabel, left.label),
			)[0];

		if (recentCandidate) {
			await attachStoryMembership(
				input.database,
				{
					annotationRunId: input.runId,
					captureId: input.captureId,
					capturedAt: input.capturedAt,
					cohortId: input.cohortId,
					label: item.normalisedLabel,
					placementKey,
					reason: "recent-label-and-entity-overlap",
					site: input.site,
					storyId: recentCandidate.storyId,
				},
				false,
			);
		} else {
			const results = await input.vectors.query(embedding, {
				filter: {
					cohort: input.cohortId,
					embeddingVersion: COMPARISON_PIPELINE.embeddingVersion,
					language: input.language,
					capturedEpoch: {
						$gte: capturedEpoch - 36 * 60 * 60 * 1_000,
						$lte: capturedEpoch + 36 * 60 * 60 * 1_000,
					},
					site: { $ne: input.site },
				},
				returnMetadata: "none",
				topK: 5,
			});
			const candidates = await Promise.all(
				results.matches.map((match) => clusterCandidate(input.database, input.cohortId, match)),
			);
			const candidate = candidates
				.filter((match): match is ClusterCandidate => match !== null)
				.find((match) =>
					canJoinStory({
						candidateCapturedAt: match.capturedAt,
						candidateEntities: match.entities,
						candidateLabel: match.label,
						capturedAt: input.capturedAt,
						entities: item.entities,
						label: item.normalisedLabel,
						similarity: match.score,
					}),
				);
			const storyId = candidate?.storyId ?? crypto.randomUUID();
			await attachStoryMembership(
				input.database,
				{
					annotationRunId: input.runId,
					captureId: input.captureId,
					capturedAt: input.capturedAt,
					cohortId: input.cohortId,
					label: item.normalisedLabel,
					placementKey,
					reason: "embedding-and-semantic-overlap",
					similarity: candidate?.score,
					site: input.site,
					storyId,
				},
				!candidate,
			);
		}
	}
	const vectorId = await sha256(
		`${input.cohortId}:${input.runId}:${item.evidenceId}:${COMPARISON_PIPELINE.embeddingVersion}`,
	);

	return {
		embeddingUpdate: input.database
			.prepare(
				`UPDATE content_annotations SET embedding_id = ?
				WHERE run_id = ? AND capture_id = ? AND placement_key = ?`,
			)
			.bind(vectorId, input.runId, input.captureId, placementKey),
		vector: {
			id: vectorId,
			metadata: {
				capturedEpoch,
				cohort: input.cohortId,
				embeddingVersion: COMPARISON_PIPELINE.embeddingVersion,
				language: input.language,
				site: input.site,
			},
			values: embedding,
		},
	};
}

export async function clusterCaptureAnnotations(input: ClusterCaptureInput): Promise<void> {
	const clustered: ClusteredAnnotation[] = [];
	const entries = [...input.annotation.annotations.entries()];
	const recentCandidates = await recentClusterCandidates(input);

	for (let offset = 0; offset < entries.length; offset += 5) {
		const batch = entries.slice(offset, offset + 5);
		clustered.push(
			...(await Promise.all(
				batch.map(([index, item]) => clusterAnnotation(input, recentCandidates, item, index)),
			)),
		);
	}

	if (clustered.length > 0) {
		await input.vectors.upsert(clustered.map(({ vector }) => vector));
		await input.database.batch(clustered.map(({ embeddingUpdate }) => embeddingUpdate));
	}
}
