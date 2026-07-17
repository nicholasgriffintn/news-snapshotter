import type { StoryObservation } from "../../core/types.ts";

function points(
	observations: StoryObservation[],
	value: (observation: StoryObservation) => number,
): string {
	if (observations.length === 0) return "";
	const values = observations.map(value);
	const maximum = Math.max(1, ...values);
	return observations
		.map((observation, index) => {
			const x = observations.length === 1 ? 50 : (index / (observations.length - 1)) * 100;
			const y = (value(observation) / maximum) * 84 + 8;
			return `${x},${y}`;
		})
		.join(" ");
}

export function StoryTimelineChart({ observations }: { observations: StoryObservation[] }) {
	return (
		<div className="story-charts">
			<figure>
				<figcaption>Rank over time</figcaption>
				<svg
					aria-label="Story rank over time"
					preserveAspectRatio="none"
					role="img"
					viewBox="0 0 100 100"
				>
					<polyline points={points(observations, ({ rank }) => rank)} />
				</svg>
				<small>Higher placement appears nearer the top.</small>
			</figure>
			<figure>
				<figcaption>Page position over time</figcaption>
				<svg
					aria-label="Story page position over time"
					preserveAspectRatio="none"
					role="img"
					viewBox="0 0 100 100"
				>
					<polyline points={points(observations, ({ top }) => top)} />
				</svg>
				<small>Distance from the top of the publisher page.</small>
			</figure>
		</div>
	);
}
