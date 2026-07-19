import type { HistoryImageObservation } from "../../core/types.ts";
import { historyScreenshotUrl } from "../../platform/api-client.ts";
import { dateTimeLabel, displayName } from "../../shared/format.ts";
import { contentHistoryPath } from "./history-routes.ts";

export function HistoryImageTimeline({
	images,
	loading,
	month,
	onMonth,
	site,
}: {
	images: HistoryImageObservation[];
	loading: boolean;
	month: string;
	onMonth: (month: string) => void;
	site: string;
}) {
	return (
		<section className="research-panel research-panel--images">
			<header>
				<div>
					<p className="research-panel__kicker">Review visual choices</p>
					<h2>Image archive</h2>
					<p className="research-panel__description">
						Browse one representative use of each unique image observed during the selected month.
					</p>
				</div>
				<label>
					<span>Month</span>
					<input onChange={(event) => onMonth(event.target.value)} type="month" value={month} />
				</label>
			</header>
			{!loading && images.length > 0 ? (
				<div className="research-results__status">
					<strong>{images.length} unique {images.length === 1 ? "image" : "images"}</strong>
					<span>Open an image to see the history of its associated content.</span>
				</div>
			) : null}
			{loading ? (
				<p aria-live="polite" className="research-empty" role="status">
					Loading monthly imagery…
				</p>
			) : null}
			<div aria-busy={loading} className="history-image-grid">
				{!loading
					? images.map((image) => (
							<a
								href={contentHistoryPath(site, image.elementKey)}
								key={`${image.captureId}:${image.imageId}`}
							>
								<img
									alt={image.alt ?? "Publisher content image"}
									loading="lazy"
									src={image.cropKey ? historyScreenshotUrl(image.cropKey) : image.sourceUrl}
								/>
								<div className="history-image-grid__copy">
									<span>{displayName(image.kind)}</span>
									<strong>{image.headline ?? image.alt ?? "Untitled image"}</strong>
									<time dateTime={image.capturedAt}>{dateTimeLabel(image.capturedAt)}</time>
								</div>
							</a>
						))
					: null}
			</div>
			{!loading && images.length === 0 ? (
				<p className="research-empty">No content images were observed in this month.</p>
			) : null}
		</section>
	);
}
