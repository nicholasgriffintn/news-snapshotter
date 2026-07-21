import {
	HISTORY_CONTENT_KIND_LABELS,
	HISTORY_CONTENT_KINDS,
} from "./domain/content-kind-filter.ts";

const STORY_ROWS = Array.from({ length: 4 }, (_, index) => index);
const CHANGE_GROUPS = Array.from({ length: 5 }, (_, index) => index);

export function HistoryCaptureSkeleton() {
	return (
		<>
			<div aria-hidden="true" className="history-capture-meta history-structured-skeleton">
				<span className="history-structured-skeleton__line history-structured-skeleton__line--date" />
				<span className="history-structured-skeleton__line history-structured-skeleton__line--meta" />
			</div>

			<section
				aria-busy="true"
				aria-hidden="true"
				className="history-evidence history-evidence--skeleton history-structured-skeleton"
			>
				<div className="history-evidence__screenshot">
					<header>
						<div>
							<span>Archived screenshot</span>
							<strong className="history-structured-skeleton__line history-structured-skeleton__line--dimensions" />
						</div>
						<button disabled type="button">
							Show content boxes
						</button>
					</header>
					<div className="history-shot-scroll">
						<div className="history-structured-skeleton__image" />
					</div>
				</div>

				<aside className="history-story-rail">
					<header>
						<span>Analysed content</span>
						<strong className="history-structured-skeleton__line history-structured-skeleton__line--summary" />
					</header>
					<div aria-label="Filter analysed content by kind" className="history-kind-filters">
						{HISTORY_CONTENT_KINDS.map((kind) => (
							<button data-kind={kind} disabled key={kind} type="button">
								<span>{HISTORY_CONTENT_KIND_LABELS[kind]}</span>
								<strong className="history-structured-skeleton__count" />
							</button>
						))}
					</div>
					<ol>
						{STORY_ROWS.map((row) => (
							<li key={row}>
								<div className="history-story-rank">
									<span className="history-structured-skeleton__rank" />
								</div>
								<div className="history-content-copy">
									<span className="history-structured-skeleton__line history-structured-skeleton__line--story-title" />
									<span className="history-structured-skeleton__line history-structured-skeleton__line--story-copy" />
									<span className="history-structured-skeleton__line history-structured-skeleton__line--story-copy-short" />
								</div>
							</li>
						))}
					</ol>
				</aside>
			</section>

			<section
				aria-hidden="true"
				className="history-changes history-changes--skeleton history-structured-skeleton"
			>
				<header>
					<h2>What changed</h2>
					<strong className="history-structured-skeleton__line history-structured-skeleton__line--event-count" />
				</header>
				<div className="history-change-groups">
					{CHANGE_GROUPS.map((group) => (
						<section className="history-change-group" key={group}>
							<h3>
								<span className="history-structured-skeleton__line history-structured-skeleton__line--group-title" />
							</h3>
							<ul>
								<li>
									<span className="history-structured-skeleton__line history-structured-skeleton__line--change-label" />
									<span className="history-structured-skeleton__line history-structured-skeleton__line--change-copy" />
								</li>
							</ul>
						</section>
					))}
				</div>
			</section>
		</>
	);
}
