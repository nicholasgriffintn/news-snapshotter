import type { HistoryFailure } from "../../core/types.ts";
import { dateTimeLabel } from "../../shared/format.ts";
import {
	groupHistoryFailures,
	historyFailureGuidance,
	historyFailureLogHref,
} from "./domain/history-failure-guidance.ts";

export function HistoryFailureNotice({
	failures,
	hasMore,
	site,
}: {
	failures: HistoryFailure[];
	hasMore: boolean;
	site: string;
}) {
	const countLabel = hasMore ? `${failures.length}+` : String(failures.length);

	return (
		<details className="history-failure-notice">
			<summary>
				<span>
					<strong>
						{countLabel} incomplete {failures.length === 1 ? "capture" : "captures"}
					</strong>
					<small>
						Their screenshots may exist, but they were not added to structured history. Successful
						captures are unaffected.
					</small>
				</span>
				<span className="history-failure-notice__toggle">Review failures</span>
			</summary>
			<div className="history-failure-notice__body">
				{groupHistoryFailures(failures).map((group) => {
					const guidance = historyFailureGuidance(group.stage);
					return (
						<section key={group.stage}>
							<header>
								<h2>{guidance.label}</h2>
								<span>{group.failures.length}</span>
							</header>
							<p>{guidance.meaning}</p>
							<ul>
								{group.failures.map((failure) => (
									<li key={`${failure.failedAt}:${failure.captureId ?? group.stage}`}>
										<time dateTime={failure.failedAt}>{dateTimeLabel(failure.failedAt)}</time>
										<code>{failure.captureId ?? "Capture ID unavailable"}</code>
									</li>
								))}
							</ul>
							<p className="history-failure-notice__resolution">
								<strong>To resolve:</strong> {guidance.resolution}
							</p>
						</section>
					);
				})}
				<nav aria-label="Failure maintenance tools">
					<a href={historyFailureLogHref(site)}>Open private diagnostics →</a>
				</nav>
			</div>
		</details>
	);
}
