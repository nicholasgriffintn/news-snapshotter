import { useState } from "react";

import { publisherResearchPath } from "../history/history-routes.ts";

import { SectionHeader } from "../../shared/PageHeaders.tsx";
import { StatusMessage } from "../../shared/StatusMessage.tsx";
import { Button, ButtonLink } from "../../shared/Button.tsx";
import { Card } from "../../shared/Card.tsx";
import { Field } from "../../shared/Field.tsx";
import { comparisonRequest, useComparisonData } from "./comparison-api.ts";
import { PageHeader } from "../../shared/PageHeaders.tsx";
import { StoryComparisonSkeleton } from "./StoryComparisonSkeleton.tsx";
import type { ComparisonFinding, ComparisonStoryDetail } from "./domain/contracts.ts";

function citedPublishers(
	finding: ComparisonFinding,
	evidenceById: ReadonlyMap<string, ComparisonStoryDetail["evidence"][number]>,
): string[] {
	return [
		...new Set(
			finding.evidenceIds
				.map((evidenceId) => evidenceById.get(evidenceId)?.displayName)
				.filter((name): name is string => Boolean(name)),
		),
	];
}

export function StoryComparisonPage({
	revisionId,
	storyId,
}: {
	revisionId?: string;
	storyId: string;
}) {
	const revisionQuery = revisionId ? `?revision=${encodeURIComponent(revisionId)}` : "";
	const detail = useComparisonData<ComparisonStoryDetail>(
		`/api/comparison/stories/${encodeURIComponent(storyId)}${revisionQuery}`,
	);
	const [reporting, setReporting] = useState(false);
	const [reportOpen, setReportOpen] = useState(false);
	const [reportNote, setReportNote] = useState("");
	const [reportReason, setReportReason] = useState("incorrect");
	const [reportError, setReportError] = useState(false);
	const [reportStatus, setReportStatus] = useState("");
	if (detail.loading && !detail.data) {
		return <StoryComparisonSkeleton />;
	}
	if (detail.error || !detail.data) {
		return (
			<section className="page-stack comparison-page">
				<PageHeader
					description="The requested story evidence could not be opened."
					title="Comparison unavailable"
				/>
				<StatusMessage role="alert" tone="error">
					{detail.error ?? "Story comparison not found"}
				</StatusMessage>
			</section>
		);
	}
	const story = detail.data;
	const evidenceById = new Map(story.evidence.map((item) => [item.evidenceId, item]));
	const analysisAvailable = story.revision.analysisStatus === "available";

	async function reportIssue() {
		setReporting(true);
		setReportError(false);
		setReportStatus("");
		try {
			await comparisonRequest("/api/comparison/feedback", {
				body: JSON.stringify({
					note: reportNote.trim() || undefined,
					reason: reportReason,
					revisionId: story.revision.revisionId,
				}),
				headers: { "content-type": "application/json" },
				method: "POST",
			});
			setReportStatus("Feedback received for review.");
			setReportNote("");
		} catch (error) {
			setReportError(true);
			setReportStatus(error instanceof Error ? error.message : "Report could not be sent");
		} finally {
			setReporting(false);
		}
	}

	function toggleReport() {
		if (reportOpen) {
			setReportOpen(false);
			setReportError(false);
			setReportStatus("");
			return;
		}

		setReportOpen(true);
	}

	return (
		<article className="page-stack comparison-page comparison-detail">
			<PageHeader
				description={story.story.summary}
				aside={
					<>
						<strong>{story.revision.sourceCount} publishers</strong>
						<span>{story.evidence.length} observations</span>
						<span>{story.window.status} window</span>
					</>
				}
				title={story.story.label}
				breadcrumbs={[{ href: "/compare", label: "All comparisons" }, { label: "Story evidence" }]}
				variant="detail"
			/>

			<StatusMessage compact tone="info">
				{analysisAvailable
					? "Findings use the captured homepage headlines and summaries shown below."
					: "Generated findings are unavailable for this revision; the captured evidence remains available below."}
			</StatusMessage>

			<section className="comparison-findings">
				<section className="comparison-finding-section">
					<h2>Shared ground</h2>

					{story.commonGround.length ? (
						<ul>
							{story.commonGround.map((finding) => {
								const publishers = citedPublishers(finding, evidenceById);

								return (
									<li key={`${finding.statement}:${finding.evidenceIds.join(",")}`}>
										{finding.statement}
										{publishers.length ? <small>{publishers.join(" · ")}</small> : null}
									</li>
								);
							})}
						</ul>
					) : (
						<p>No shared detail passed the publication threshold.</p>
					)}
				</section>

				<section className="comparison-finding-section">
					<h2>How coverage differs</h2>

					{story.differences.length ? (
						<ul>
							{story.differences.map((finding) => {
								const publishers = citedPublishers(finding, evidenceById);

								return (
									<li key={`${finding.statement}:${finding.evidenceIds.join(",")}`}>
										{finding.statement}
										{publishers.length ? <small>{publishers.join(" · ")}</small> : null}
									</li>
								);
							})}
						</ul>
					) : (
						<p>No difference statement has passed review for this revision.</p>
					)}
				</section>
			</section>

			<section className="comparison-evidence">
				<SectionHeader
					aside={<strong>{story.evidence.length} observations</strong>}
					description="Read the captured wording behind the published comparison."
					title="Source evidence"
				/>

				<div className="comparison-evidence__rail">
					{story.evidence.map((item) => (
						<Card className="comparison-evidence-card" key={item.evidenceId}>
							<header className="ui-card-meta">
								<a className="ui-card-meta__label" href={publisherResearchPath(item.site)}>
									{item.displayName}
								</a>
								<span>
									{item.prominence ?? "standard"} · #{item.rank}
								</span>
							</header>
							<div className="comparison-evidence-card__body">
								<h3 className="ui-card-title">{item.headline}</h3>
								{item.summary ? <p className="ui-card-description">{item.summary}</p> : null}
							</div>
							<div
								className={`ui-card-actions comparison-evidence__actions${item.url ? " ui-card-actions--split" : ""}`}
							>
								{item.url ? (
									<ButtonLink
										aria-label={`Open ${item.displayName} publisher page in a new tab`}
										href={item.url}
										layout="card"
										rel="noopener noreferrer"
										target="_blank"
										variant="secondary"
									>
										Publisher page ↗
									</ButtonLink>
								) : null}
								<ButtonLink
									aria-label={`View ${item.displayName} evidence in capture`}
									href={item.archiveUrl}
									layout="card"
								>
									View in capture
								</ButtonLink>
							</div>
						</Card>
					))}
				</div>
			</section>

			<section className="comparison-report">
				<header className="comparison-report__header">
					<div>
						<h2>Spot an issue?</h2>
						<p>Feedback is reviewed by a person and helps improve future comparisons.</p>
					</div>
					<Button
						aria-controls="comparison-report-content"
						aria-expanded={reportOpen}
						onClick={toggleReport}
						variant="secondary"
					>
						{reportOpen ? (reportStatus && !reportError ? "Close" : "Cancel") : "Share feedback"}
					</Button>
				</header>
				<div id="comparison-report-content">
					{reportOpen && (!reportStatus || reportError) ? (
						<form
							onSubmit={(event) => {
								event.preventDefault();
								void reportIssue();
							}}
						>
							<Field label="Issue">
								<select
									onChange={(event) => setReportReason(event.target.value)}
									value={reportReason}
								>
									<option value="incorrect">Incorrect finding</option>
									<option value="unsupported">Not supported by evidence</option>
									<option value="missing-context">Missing context</option>
									<option value="other">Other</option>
								</select>
							</Field>
							<Field label="Note (optional)">
								<textarea
									maxLength={1_000}
									onChange={(event) => setReportNote(event.target.value)}
									rows={3}
									value={reportNote}
								/>
							</Field>
							<Button disabled={reporting} type="submit">
								{reporting ? "Sending…" : "Send feedback"}
							</Button>
						</form>
					) : null}
					{reportStatus ? (
						<StatusMessage
							compact
							role={reportError ? "alert" : "status"}
							tone={reportError ? "error" : "success"}
						>
							{reportStatus}
						</StatusMessage>
					) : null}
				</div>
			</section>
		</article>
	);
}
