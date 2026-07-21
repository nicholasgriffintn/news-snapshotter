import type { CSSProperties } from "react";

import type { HistoryTrends } from "../../core/types.ts";
import { Card } from "../../shared/Card.tsx";
import { Field } from "../../shared/Field.tsx";
import { calendarPeriodLabel } from "../../shared/format.ts";
import { NoDataState } from "../../shared/NoDataState.tsx";
import { SectionHeader } from "../../shared/PageHeaders.tsx";
import { StatusMessage } from "../../shared/StatusMessage.tsx";
import { isResearchPeriod, type ResearchPeriod } from "./domain/research-state.ts";

function isTrendMode(value: string): value is HistoryTrends["mode"] {
	return ["category", "main-headline-words", "all-headline-words"].includes(value);
}

function weightedStyle(name: "--bar" | "--weight", value: number): CSSProperties {
	return { [name]: value };
}

export function HistoryTrendPanel({
	error,
	loading,
	mode,
	onMode,
	onPeriod,
	period,
	trends,
}: {
	error?: string;
	loading: boolean;
	mode: HistoryTrends["mode"];
	onMode: (mode: HistoryTrends["mode"]) => void;
	onPeriod: (period: ResearchPeriod) => void;
	period: ResearchPeriod;
	trends?: HistoryTrends;
}) {
	const latest = trends?.periods.at(-1);
	const maximum = Math.max(1, ...(latest?.values.map(({ weightSeconds }) => weightSeconds) ?? [1]));

	return (
		<Card as="section" className="research-panel research-panel--trends">
			<SectionHeader
				aside={
					<div className="research-controls">
						<Field label="View">
							<select
								disabled={loading}
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
						</Field>
						<Field label="Period">
							<select
								disabled={loading}
								onChange={(event) => {
									if (isResearchPeriod(event.target.value)) {
										onPeriod(event.target.value);
									}
								}}
								value={period}
							>
								<option value="24h">24 hours</option>
								<option value="7d">7 days</option>
								<option value="30d">30 days</option>
								<option value="90d">90 days</option>
								<option value="all">All history</option>
							</select>
						</Field>
					</div>
				}
				description="See which categories or headline terms occupied the page. Estimates use the time between consecutive captures."
				title="Coverage patterns"
			/>

			{error ? (
				<StatusMessage compact role="alert" tone="error">
					{error}
				</StatusMessage>
			) : loading ? (
				<StatusMessage compact role="status">
					Calculating coverage…
				</StatusMessage>
			) : latest ? (
				mode === "category" ? (
					<>
						<div className="research-figure-heading">
							<strong>{calendarPeriodLabel(latest.period)}</strong>
							<span>Top categories · estimated content-hours</span>
						</div>
						<div className="trend-bars">
							{latest.values.slice(0, 12).map((value) => (
								<div key={value.label}>
									<span className="trend-bars__label">
										<strong>{value.label}</strong>
										<small>{value.count} appearances</small>
									</span>
									<span className="trend-bars__track">
										<i style={weightedStyle("--bar", value.weightSeconds / maximum)} />
									</span>
									<strong>{Math.round(value.weightSeconds / 3_600)}h</strong>
								</div>
							))}
						</div>
						{trends && trends.periods.length > 1 ? (
							<div className="trend-periods" aria-label="Leading category by capture period">
								<h3>Leading category by capture period</h3>
								{trends.periods.map((trendPeriod) => (
									<div key={trendPeriod.period}>
										<time>{calendarPeriodLabel(trendPeriod.period)}</time>
										<strong>{trendPeriod.values[0]?.label ?? "No observations"}</strong>
									</div>
								))}
							</div>
						) : null}
					</>
				) : (
					<>
						<div className="research-figure-heading">
							<strong>{calendarPeriodLabel(latest.period)}</strong>
							<span>Size reflects estimated time visible in captured headlines</span>
						</div>
						<div
							className="word-cloud"
							aria-label="Headline terms weighted by estimated time visible"
						>
							{latest.values.slice(0, 40).map((value) => (
								<span
									aria-label={`${value.label}: ${Math.round(value.weightSeconds / 3_600)} estimated content-hours`}
									key={value.label}
									style={weightedStyle("--weight", value.weightSeconds / maximum)}
									title={`${Math.round(value.weightSeconds / 3_600)} estimated content-hours`}
								>
									{value.label}
								</span>
							))}
						</div>
					</>
				)
			) : (
				<NoDataState
					compact
					description="Choose a wider period or try another coverage view."
					title="No trend observations available"
				/>
			)}
		</Card>
	);
}
