import type { SiteDefinition } from "../../../core/domain.ts";
import type { Env } from "../../../platform/cloudflare/env.ts";
import { COMPARISON_COHORTS, comparisonSites } from "../domain/configuration.ts";
import { TerminalAnalysisError, type AnalysisMessage } from "../domain/pipeline.ts";
import {
	comparisonWindowProgress,
	ensureComparisonWindow,
	finaliseComparisonWindow,
} from "../infrastructure/comparison-window-repository.ts";
import { analyseCapture } from "./analyse-capture.ts";
import { publishWindowStories } from "./publish-window-stories.ts";

export async function processAnalysisMessage(env: Env, body: AnalysisMessage): Promise<void> {
	if (body.kind === "analyse-capture") {
		const result = await analyseCapture(env, body);
		if (body.finaliseAfterAnalysis && result.status === "succeeded") {
			for (const window of result.windows ?? []) {
				await env.ANALYSIS_QUEUE.send({
					cohortId: window.cohortId,
					deadlineAt: new Date().toISOString(),
					kind: "finalise-window",
					windowId: window.windowId,
				});
			}
		}
		return;
	}
	const cohort = COMPARISON_COHORTS.find(({ id }) => id === body.cohortId);
	if (!cohort) {
		throw new TerminalAnalysisError(`Unknown comparison cohort: ${body.cohortId}`);
	}
	const deadline = Date.parse(body.deadlineAt);
	if (!Number.isFinite(deadline)) {
		throw new TerminalAnalysisError("Comparison finalisation deadline is invalid");
	}
	const progress = await comparisonWindowProgress(env.HISTORY_DB, body.windowId);
	if (progress.analysedSites < progress.expectedSites && Date.now() < deadline) {
		const remainingSeconds = Math.ceil((deadline - Date.now()) / 1_000);
		const delaySeconds = Math.max(1, Math.min(5 * 60, remainingSeconds));

		await env.ANALYSIS_QUEUE.send(body, {
			delaySeconds,
		});
		console.log(
			JSON.stringify({
				analysedSites: progress.analysedSites,
				event: "comparison-window-rescheduled",
				expectedSites: progress.expectedSites,
				windowId: body.windowId,
			}),
		);
		return;
	}
	const status = await finaliseComparisonWindow(
		env.HISTORY_DB,
		body.windowId,
		cohort.minimumAnalysedSites,
	);
	const publishedStories =
		status === "suppressed"
			? 0
			: await publishWindowStories(env, {
					cohortId: cohort.id,
					windowId: body.windowId,
				});

	console.log(
		JSON.stringify({
			event: "comparison-window-finalised",
			publishedStories,
			status,
			windowId: body.windowId,
		}),
	);
}

export async function scheduleComparisonWindows(
	env: Pick<Env, "ANALYSIS_QUEUE" | "HISTORY_DB">,
	dispatchedSites: readonly SiteDefinition[],
	triggeredAt: string,
): Promise<number> {
	let scheduled = 0;
	for (const cohort of COMPARISON_COHORTS) {
		const expectedSites = comparisonSites(dispatchedSites, cohort.id);
		if (expectedSites.length === 0) {
			continue;
		}
		const window = await ensureComparisonWindow(env.HISTORY_DB, cohort, expectedSites, triggeredAt);
		const deadlineAt = new Date(Date.parse(triggeredAt) + 45 * 60_000).toISOString();
		await env.ANALYSIS_QUEUE.send(
			{
				cohortId: cohort.id,
				deadlineAt,
				kind: "finalise-window",
				windowId: window.windowId,
			},
			{ delaySeconds: 15 * 60 },
		);
		scheduled += 1;
	}
	return scheduled;
}
