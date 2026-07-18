import type { CSSProperties } from "react";

import type { HistoryTrends } from "../../core/types.ts";

function isTrendMode(value: string): value is HistoryTrends["mode"] {
	return ["category", "main-headline-words", "all-headline-words"].includes(value);
}

function weightedStyle(name: "--bar" | "--weight", value: number): CSSProperties {
	return { [name]: value };
}

export function HistoryTrendPanel({
	mode,
	onMode,
	onPeriod,
	period,
	trends,
}: {
	mode: HistoryTrends["mode"];
	onMode: (mode: HistoryTrends["mode"]) => void;
	onPeriod: (period: string) => void;
	period: string;
	trends?: HistoryTrends;
}) {
	const latest = trends?.periods.at(-1);
	const maximum = Math.max(1, ...(latest?.values.map(({ weightSeconds }) => weightSeconds) ?? [1]));

	return (
		<section className="research-panel research-panel--trends">
			<header>
				<div>
					<h2>Coverage over time</h2>
				</div>
				<div className="research-controls">
					<label>
						<span>View</span>
						<select
							onChange={(event) => {
								if (isTrendMode(event.target.value)) {
									onMode(event.target.value);
								}
							}}
							value={mode}
						>
							<option value="category">Categories</option>
							<option value="main-headline-words">Main headline words</option>
							<option value="all-headline-words">All headline words</option>
						</select>
					</label>
					<label>
						<span>Period</span>
						<select onChange={(event) => onPeriod(event.target.value)} value={period}>
							<option value="24h">24 hours</option>
							<option value="7d">7 days</option>
							<option value="30d">30 days</option>
							<option value="90d">90 days</option>
							<option value="all">All history</option>
						</select>
					</label>
				</div>
			</header>

			{latest ? (
				mode === "category" ? (
					<>
						<div className="trend-bars">
							{latest.values.slice(0, 12).map((value) => (
								<div key={value.label}>
									<span>{value.label}</span>
									<i style={weightedStyle("--bar", value.weightSeconds / maximum)} />
									<small>{Math.round(value.weightSeconds / 3_600)} weighted hours</small>
								</div>
							))}
						</div>
						{trends && trends.periods.length > 1 ? (
							<div className="trend-periods">
								{trends.periods.map((trendPeriod) => (
									<div key={trendPeriod.period}>
										<time>{trendPeriod.period}</time>
										<p>
											{trendPeriod.values
												.slice(0, 3)
												.map(({ label }) => label)
												.join(" · ")}
										</p>
									</div>
								))}
							</div>
						) : null}
					</>
				) : (
					<div className="word-cloud" aria-label="Weighted headline words">
						{latest.values.slice(0, 40).map((value) => (
							<span
								key={value.label}
								style={weightedStyle("--weight", value.weightSeconds / maximum)}
								title={`${Math.round(value.weightSeconds / 3_600)} weighted hours`}
							>
								{value.label}
							</span>
						))}
					</div>
				)
			) : (
				<p className="research-empty">No trend observations are available for this period.</p>
			)}
		</section>
	);
}
