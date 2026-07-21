import type { HistoryImageObservation } from "../../core/types.ts";
import { Button } from "../../shared/Button.tsx";
import { Card } from "../../shared/Card.tsx";
import { Field } from "../../shared/Field.tsx";
import { historyScreenshotUrl } from "../../platform/api-client.ts";
import { dateTimeLabel, displayName } from "../../shared/format.ts";
import { NoDataState } from "../../shared/NoDataState.tsx";
import { SectionHeader } from "../../shared/PageHeaders.tsx";
import { StatusMessage } from "../../shared/StatusMessage.tsx";
import { contentHistoryPath } from "./history-routes.ts";

export function HistoryImageTimeline({
	error,
	images,
	hasMore,
	loading,
	loadingMore,
	month,
	onLoadMore,
	onMonth,
	site,
}: {
	error?: string;
	hasMore: boolean;
	images: HistoryImageObservation[];
	loading: boolean;
	loadingMore: boolean;
	month: string;
	onLoadMore: () => void;
	onMonth: (month: string) => void;
	site: string;
}) {
	return (
		<Card as="section" className="research-panel research-panel--images">
			<SectionHeader
				aside={
					<Field label="Month">
						<input
							max={new Date().toISOString().slice(0, 7)}
							onChange={(event) => onMonth(event.target.value)}
							type="month"
							value={month}
						/>
					</Field>
				}
				description="Browse one representative use of each unique image observed during the selected month."
				title="Image archive"
			/>
			{!loading && images.length > 0 ? (
				<div className="research-results__status">
					<strong>
						{images.length} unique {images.length === 1 ? "image" : "images"}{" "}
						{hasMore ? "loaded" : ""}
					</strong>
					<span>Open an image to see the history of its associated content.</span>
				</div>
			) : null}
			{error ? (
				<StatusMessage compact role="alert" tone="error">
					{error}
				</StatusMessage>
			) : null}
			{loading ? (
				<StatusMessage compact role="status">
					Loading monthly imagery…
				</StatusMessage>
			) : null}
			<div aria-busy={loading} className="history-image-grid">
				{!loading
					? images.map((image) => (
							<a
								href={contentHistoryPath(site, image.elementKey)}
								key={`${image.captureId}:${image.imageId}`}
							>
								<img
									alt={image.alt?.trim() || "Publisher content image"}
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
			{hasMore ? (
				<div className="research-pagination">
					<span>More images are available for this month</span>
					<Button disabled={loadingMore} onClick={onLoadMore} variant="secondary">
						{loadingMore ? "Loading more…" : "Load more images"}
					</Button>
				</div>
			) : null}
			{!loading && !error && images.length === 0 ? (
				<NoDataState
					compact
					description="Choose another month to look for captured publisher imagery."
					title="No content images observed"
				/>
			) : null}
		</Card>
	);
}
