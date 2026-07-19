import type { HistoryCaptureSummary } from "../../core/types.ts";
import { dateTimeLabel } from "../../shared/format.ts";
import { captureTimelinePosition } from "./domain/capture-timeline.ts";

export function HistoryScrubber({
	captures,
	hasOlder,
	loadingOlder,
	onLoadOlder,
	onSelect,
	selectedCapturedAt,
	selectedId,
}: {
	captures: HistoryCaptureSummary[];
	hasOlder: boolean;
	loadingOlder: boolean;
	onLoadOlder: () => void;
	onSelect: (captureId: string) => void;
	selectedCapturedAt?: string;
	selectedId?: string;
}) {
	const { newer, older, selected, selectedIndex } = captureTimelinePosition(captures, selectedId);
	const selectedTime = selected
		? dateTimeLabel(selected.capturedAt)
		: selectedCapturedAt
			? dateTimeLabel(selectedCapturedAt)
			: undefined;
	const outsideLoadedTimeline = Boolean(selectedId && selectedIndex < 0);

	return (
		<section aria-label="Capture timeline" className="history-scrubber">
			<div className="history-scrubber__clock">
				<span>Selected capture</span>
				<strong>
					{selectedTime ?? (selectedId ? "Loading selected capture…" : "No capture selected")}
				</strong>
				<small>
					{outsideLoadedTimeline
						? "Selected capture is outside the loaded timeline"
						: selected
							? `Capture ${selectedIndex + 1} of ${captures.length} loaded`
							: "No captures loaded"}
					{hasOlder ? " · earlier captures available" : ""}
				</small>
			</div>
			<div className="history-scrubber__timeline">
				<div className="history-scrubber__heading">
					<label htmlFor="history-capture-range">Browse captures</label>
					<span aria-hidden="true">Newest to oldest</span>
				</div>
				<span className="sr-only" id="history-capture-direction">
					The timeline runs from the newest capture on the left to the oldest loaded capture on the
					right.
				</span>
				<div className="history-scrubber__controls">
					<button
						aria-label={
							newer ? `Show newer capture from ${dateTimeLabel(newer.capturedAt)}` : undefined
						}
						disabled={!newer}
						onClick={() => newer && onSelect(newer.captureId)}
						type="button"
					>
						<span aria-hidden="true">←</span> Newer
					</button>
					<div className="history-scrubber__track">
						<input
							aria-describedby="history-capture-direction"
							aria-valuetext={selectedTime}
							disabled={captures.length < 2 || outsideLoadedTimeline}
							id="history-capture-range"
							max={Math.max(0, captures.length - 1)}
							min="0"
							onChange={(event) => {
								const capture = captures[Number(event.target.value)];
								if (capture) {
									onSelect(capture.captureId);
								}
							}}
							type="range"
							value={Math.max(0, selectedIndex)}
						/>
						<div aria-hidden="true" className="history-scrubber__ticks">
							<span>Newest</span>
							<span>Oldest loaded</span>
						</div>
					</div>
					<button
						aria-label={
							older ? `Show older capture from ${dateTimeLabel(older.capturedAt)}` : undefined
						}
						disabled={!older}
						onClick={() => older && onSelect(older.captureId)}
						type="button"
					>
						Older <span aria-hidden="true">→</span>
					</button>
				</div>
				{hasOlder ? (
					<button
						className="history-scrubber__load"
						disabled={loadingOlder}
						onClick={onLoadOlder}
						type="button"
					>
						{loadingOlder ? "Loading earlier captures…" : "Load earlier captures"}
					</button>
				) : null}
			</div>
		</section>
	);
}
