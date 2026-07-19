import { isAnalysedContentKind } from "../../../core/contracts.ts";
import { historyScreenshotUrl } from "../../platform/api-client.ts";
import type { HistoryCapture } from "../../core/types.ts";
import { HistoryContentItem } from "./HistoryContentItem.tsx";

export function HistoryCaptureView({
	capture,
	overlay,
	onToggleOverlay,
}: {
	capture: HistoryCapture;
	overlay: boolean;
	onToggleOverlay: () => void;
}) {
	const content = capture.elements.filter(({ kind }) => isAnalysedContentKind(kind));
	const stories = content.filter(({ kind }) => kind === "story");
	const videos = content.filter(({ kind }) => kind === "video");
	const audio = content.filter(({ kind }) => kind === "audio");
	const pageWidth = Math.max(capture.capture.pageWidth, 1);
	const pageHeight = Math.max(capture.capture.pageHeight, 1);
	const contentSummary = [
		`${stories.length} stories`,
		...(videos.length > 0 ? [`${videos.length} videos`] : []),
		...(audio.length > 0 ? [`${audio.length} audio`] : []),
	].join(" · ");

	return (
		<section className="history-evidence">
			<div className="history-evidence__screenshot">
				<header>
					<div>
						<span>Archived screenshot</span>
						<strong>
							{capture.capture.pageWidth} × {capture.capture.pageHeight}px
						</strong>
					</div>
					<button aria-pressed={overlay} onClick={onToggleOverlay} type="button">
						{overlay ? "Hide content boxes" : "Show content boxes"}
					</button>
				</header>
				<div className="history-shot-scroll">
					<div className="history-shot" style={{ aspectRatio: `${pageWidth} / ${pageHeight}` }}>
						<img
							alt={`Full-page capture of ${capture.capture.site}`}
							src={historyScreenshotUrl(capture.capture.screenshotKey)}
						/>
						{overlay
							? content.map((element) => (
									<span
										aria-label={`${element.kind} ${element.position.pageOrder}: ${element.headline ?? "Untitled"}`}
										className={`history-shot__box history-shot__box--${element.prominence ?? "standard"} history-shot__box--${element.kind}`}
										key={element.elementKey}
										style={{
											height: `${(element.position.height / pageHeight) * 100}%`,
											left: `${(element.position.left / pageWidth) * 100}%`,
											top: `${(element.position.top / pageHeight) * 100}%`,
											width: `${(element.position.width / pageWidth) * 100}%`,
										}}
									>
										{element.position.pageOrder}
									</span>
								))
							: null}
					</div>
				</div>
			</div>

			<aside className="history-story-rail">
				<header>
					<span>Analysed content</span>
					<strong>{contentSummary}</strong>
				</header>
				<ol>
					{content.map((element) => (
						<HistoryContentItem
							element={element}
							key={element.elementKey}
							site={capture.capture.site}
						/>
					))}
				</ol>
			</aside>
		</section>
	);
}
