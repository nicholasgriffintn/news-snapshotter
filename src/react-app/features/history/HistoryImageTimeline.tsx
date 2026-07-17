import type { HistoryImageObservation } from "../../core/types.ts";
import { historyScreenshotUrl } from "../../platform/api-client.ts";

export function HistoryImageTimeline({
	images,
	month,
	onMonth,
	site,
}: {
	images: HistoryImageObservation[];
	month: string;
	onMonth: (month: string) => void;
	site: string;
}) {
	return (
		<section className="research-panel research-panel--images">
			<header>
				<div>
					<p className="eyebrow">Publisher imagery</p>
					<h2>Images through the month</h2>
				</div>
				<label>
					<span>Month</span>
					<input onChange={(event) => onMonth(event.target.value)} type="month" value={month} />
				</label>
			</header>
			<div className="history-image-grid">
				{images.map((image) => (
					<a
						href={`/history/${encodeURIComponent(site)}/stories/${encodeURIComponent(image.storyId)}`}
						key={`${image.captureId}:${image.imageId}`}
					>
						<img
							alt={image.alt ?? "Publisher story image"}
							loading="lazy"
							src={image.cropKey ? historyScreenshotUrl(image.cropKey) : image.sourceUrl}
						/>
						<strong>{image.headline ?? image.alt ?? "Untitled image"}</strong>
						<time dateTime={image.capturedAt}>
							{new Date(image.capturedAt).toLocaleString("en-GB")}
						</time>
					</a>
				))}
			</div>
			{images.length === 0 ? (
				<p className="research-empty">No story images were observed in this month.</p>
			) : null}
		</section>
	);
}
