import { historyScreenshotUrl } from "../../platform/api-client.ts";
import type { HistoryCapture, HistoryElement } from "../../core/types.ts";

function storyId(site: string, element: HistoryElement): string {
	return `${site}:${element.canonicalUrl ?? element.elementKey}`;
}

export function HistoryCaptureView({
	capture,
	overlay,
	onToggleOverlay,
}: {
	capture: HistoryCapture;
	overlay: boolean;
	onToggleOverlay: () => void;
}) {
	const stories = capture.elements.filter((element) => element.kind === "story");
	const pageWidth = Math.max(capture.capture.pageWidth, 1);
	const pageHeight = Math.max(capture.capture.pageHeight, 1);

	return (
		<section className="history-evidence">
			<div className="history-evidence__screenshot">
				<header>
					<div>
						<span>Visual source of truth</span>
						<strong>
							{capture.capture.pageWidth} × {capture.capture.pageHeight}px
						</strong>
					</div>
					<button aria-pressed={overlay} onClick={onToggleOverlay} type="button">
						{overlay ? "Hide story boxes" : "Show story boxes"}
					</button>
				</header>
				<div className="history-shot-scroll">
					<div className="history-shot" style={{ aspectRatio: `${pageWidth} / ${pageHeight}` }}>
						<img
							alt={`Full-page capture of ${capture.capture.site}`}
							src={historyScreenshotUrl(capture.capture.screenshotKey)}
						/>
						{overlay
							? stories.map((story) => (
									<span
										aria-label={`Story ${story.position.pageOrder}: ${story.headline ?? "Untitled"}`}
										className={`history-shot__box history-shot__box--${story.prominence ?? "standard"}`}
										key={story.elementKey}
										style={{
											height: `${(story.position.height / pageHeight) * 100}%`,
											left: `${(story.position.left / pageWidth) * 100}%`,
											top: `${(story.position.top / pageHeight) * 100}%`,
											width: `${(story.position.width / pageWidth) * 100}%`,
										}}
									>
										{story.position.pageOrder}
									</span>
								))
							: null}
					</div>
				</div>
			</div>

			<aside className="history-story-rail">
				<header>
					<span>Structured reading</span>
					<strong>{stories.length} stories</strong>
				</header>
				<ol>
					{stories.map((story) => (
						<li key={story.elementKey}>
							<div>
								<span>{story.position.pageOrder}</span>
								<small>{story.prominence ?? "standard"}</small>
							</div>
							<a
								href={`/history/${encodeURIComponent(capture.capture.site)}/stories/${encodeURIComponent(storyId(capture.capture.site, story))}`}
							>
								<strong>{story.headline ?? "Untitled story"}</strong>
								{story.summary ? <p>{story.summary}</p> : null}
								<small>{story.section ?? story.category ?? "Uncategorised"}</small>
							</a>
						</li>
					))}
				</ol>
			</aside>
		</section>
	);
}
