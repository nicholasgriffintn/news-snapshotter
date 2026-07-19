import type { HistoryCaptureSummary } from "../../core/types.ts";

function fullTime(value: string): string {
	return new Date(value).toLocaleString("en-GB", {
		dateStyle: "medium",
		timeStyle: "medium",
	});
}

export function HistoryScrubber({
	captures,
	hasOlder,
	loadingOlder,
	newer,
	older,
	onLoadOlder,
	onSelect,
	selectedId,
}: {
	captures: HistoryCaptureSummary[];
	hasOlder: boolean;
	loadingOlder: boolean;
	newer?: HistoryCaptureSummary;
	older?: HistoryCaptureSummary;
	onLoadOlder: () => void;
	onSelect: (captureId: string) => void;
	selectedId?: string;
}) {
	const selectedIndex = Math.max(
		0,
		captures.findIndex(({ captureId }) => captureId === selectedId),
	);
	const selected = captures[selectedIndex];

	return (
		<section aria-label="Capture timeline" className="history-scrubber">
			<button disabled={!older} onClick={() => older && onSelect(older.captureId)} type="button">
				← Previous
			</button>
			<div className="history-scrubber__clock">
				<span>Archive time</span>
				<strong>{selected ? fullTime(selected.capturedAt) : "No capture selected"}</strong>
				<small>
					{captures.length} captures loaded{hasOlder ? " · older records available" : ""}
				</small>
			</div>
			<div className="history-scrubber__track">
				<label htmlFor="history-capture-range">Move through captures</label>
				<input
					aria-valuetext={selected ? fullTime(selected.capturedAt) : undefined}
					disabled={captures.length < 2}
					id="history-capture-range"
					max={Math.max(0, captures.length - 1)}
					min="0"
					onChange={(event) => onSelect(captures[Number(event.target.value)].captureId)}
					type="range"
					value={selectedIndex}
				/>
				<div aria-hidden="true" className="history-scrubber__ticks">
					<span>Newest</span>
					<span>Oldest loaded</span>
				</div>
			</div>
			<div className="history-scrubber__actions">
				<button disabled={!newer} onClick={() => newer && onSelect(newer.captureId)} type="button">
					Next →
				</button>
				{hasOlder ? (
					<button disabled={loadingOlder} onClick={onLoadOlder} type="button">
						{loadingOlder ? "Loading…" : "Load older"}
					</button>
				) : null}
			</div>
		</section>
	);
}
