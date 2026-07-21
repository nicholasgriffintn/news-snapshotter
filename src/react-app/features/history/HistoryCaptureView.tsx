import { useMemo, useState } from "react";

import { historyScreenshotUrl } from "../../platform/api-client.ts";
import type { HistoryCapture, PageElementKind } from "../../core/types.ts";
import { HistoryContentItem } from "./HistoryContentItem.tsx";
import {
	contentKindCounts,
	contentWithKinds,
	DEFAULT_HISTORY_CONTENT_KINDS,
	HISTORY_CONTENT_KIND_LABELS,
	HISTORY_CONTENT_KINDS,
	toggledContentKinds,
} from "./domain/content-kind-filter.ts";


export function HistoryCaptureView({
	capture,
	overlay,
	onToggleOverlay,
}: {
	capture: HistoryCapture;
	overlay: boolean;
	onToggleOverlay: () => void;
}) {
	const content = capture.elements;
	const [visibleKinds, setVisibleKinds] = useState<ReadonlySet<PageElementKind>>(
		() => new Set(DEFAULT_HISTORY_CONTENT_KINDS),
	);
	const counts = useMemo(() => contentKindCounts(content), [content]);
	const visibleContent = useMemo(
		() => contentWithKinds(content, visibleKinds),
		[content, visibleKinds],
	);
	const pageWidth = Math.max(capture.capture.pageWidth, 1);
	const pageHeight = Math.max(capture.capture.pageHeight, 1);
	const contentSummary = `${visibleContent.length} shown · ${content.length} total`;

	function toggleKind(kind: PageElementKind) {
		setVisibleKinds((current) => toggledContentKinds(current, kind));
	}

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
							? visibleContent.map((element) => (
									<span
										aria-label={`${element.kind} ${element.position.pageOrder}: ${element.headline ?? "Untitled"}`}
										className={`history-shot__box history-shot__box--${element.prominence ?? "standard"} history-shot__box--${element.kind}`}
										key={element.placementKey ?? element.elementKey}
										style={{
											height: `${(element.position.height / pageHeight) * 100}%`,
											left: `${(element.position.left / pageWidth) * 100}%`,
											top: `${(element.position.top / pageHeight) * 100}%`,
											width: `${(element.position.width / pageWidth) * 100}%`,
										}}
									>
										<span>{element.position.pageOrder}</span>
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
				<div aria-label="Filter analysed content by kind" className="history-kind-filters">
					{HISTORY_CONTENT_KINDS.map((kind) => (
						<button
							aria-pressed={visibleKinds.has(kind)}
							data-kind={kind}
							key={kind}
							onClick={() => toggleKind(kind)}
							type="button"
						>
							<span>{HISTORY_CONTENT_KIND_LABELS[kind]}</span>
							<strong>{counts[kind]}</strong>
						</button>
					))}
				</div>
				{visibleContent.length > 0 ? (
					<ol>
						{visibleContent.map((element) => (
							<HistoryContentItem
								element={element}
								key={element.placementKey ?? element.elementKey}
								site={capture.capture.site}
							/>
						))}
					</ol>
				) : (
					<p className="history-story-rail__empty">Select a content kind to show it here.</p>
				)}
			</aside>
		</section>
	);
}
