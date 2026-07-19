import type { ContentObservation } from "../../core/types.ts";
import { timelinePoints } from "./story-timeline.ts";

function TimelinePlot({
	caption,
	format,
	note,
	values,
}: {
	caption: string;
	format: (value: number) => string;
	note: string;
	values: number[];
}) {
	const points = timelinePoints(values);
	const polyline = points.map(({ x, y }) => `${x},${y}`).join(" ");
	const first = values[0];
	const latest = values.at(-1);

	return (
		<figure>
			<figcaption>{caption}</figcaption>
			<svg aria-label={caption} preserveAspectRatio="none" role="img" viewBox="0 0 100 100">
				<line className="story-chart-axis" x1="8" x2="92" y1="88" y2="88" />
				<polyline points={polyline} />
				{points.map(({ value, x, y }, index) => (
					<line
						aria-label={format(value)}
						className="story-chart-point"
						key={`${index}:${value}`}
						x1={x}
						x2={x}
						y1={y - 0.1}
						y2={y + 0.1}
					/>
				))}
			</svg>
			<div className="story-chart-values">
				<span>First {first === undefined ? "—" : format(first)}</span>
				<span>Latest {latest === undefined ? "—" : format(latest)}</span>
			</div>
			<small>{note}</small>
		</figure>
	);
}

export function ContentTimelineChart({ observations }: { observations: ContentObservation[] }) {
	return (
		<div className="story-charts">
			<TimelinePlot
				caption="Rank over time"
				format={(value) => `#${value}`}
				note="A lower rank means greater prominence."
				values={observations.map(({ rank }) => rank)}
			/>
			<TimelinePlot
				caption="Page position over time"
				format={(value) => `${value.toFixed(1)} pages`}
				note="Distance from the top of the publisher page."
				values={observations.map(({ viewportDepth }) => viewportDepth)}
			/>
		</div>
	);
}
