import type { HistoryChange } from "../../core/types.ts";
import { changeLabel, changeValue, groupHistoryChanges } from "./domain/change-groups.ts";

const GROUPS = ["appeared", "disappeared", "content", "prominence", "position"] as const;

export function HistoryChangePanel({ changes }: { changes: HistoryChange[] }) {
	const grouped = groupHistoryChanges(changes);

	return (
		<section className="history-changes">
			<header>
				<div>
					<p className="eyebrow">Compared with the previous valid capture</p>
					<h2>What changed</h2>
				</div>
				<strong>{changes.length} events</strong>
			</header>
			{changes.length === 0 ? (
				<p className="history-changes__empty">
					No material changes crossed the configured thresholds.
				</p>
			) : (
				<div className="history-change-groups">
					{GROUPS.flatMap((group) => {
						const events = grouped.get(group);
						return events
							? [
									<section
										className={`history-change-group history-change-group--${group}`}
										key={group}
									>
										<h3>
											{group} <span>{events.length}</span>
										</h3>
										<ul>
											{events.map((change) => (
												<li key={change.changeId}>
													<strong>{changeLabel(change.type)}</strong>
													{change.storyId ? (
														<small>{change.storyId.split(":").at(-1)}</small>
													) : null}
													{change.before !== null || change.after !== null ? (
														<p>
															<del>{changeValue(change.before)}</del>
															<span aria-hidden="true">→</span>
															<ins>{changeValue(change.after)}</ins>
														</p>
													) : null}
												</li>
											))}
										</ul>
									</section>,
								]
							: [];
					})}
				</div>
			)}
		</section>
	);
}
