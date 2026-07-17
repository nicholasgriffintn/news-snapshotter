import { useEffect, useState } from "react";

import { startBotCheck, type BotCheckResult } from "../../platform/api-client.ts";
import { displayName } from "../../shared/format.ts";
import { groupSnapshotVariants } from "../archive/domain/snapshot-groups.ts";
import type { Snapshot, SnapshotGroup } from "../../core/types.ts";
import { SnapshotCard } from "../archive/SnapshotCard";
import { SnapshotModal } from "../archive/SnapshotModal";

function botCheckSnapshot(
	result: BotCheckResult,
	capture: BotCheckResult["results"][number],
): Snapshot | undefined {
	if (
		!capture.capturedAt ||
		!capture.key ||
		!capture.fullImageUrl ||
		!capture.thumbnailUrl ||
		!capture.triggeredAt
	) {
		return undefined;
	}

	return {
		brand: "amiabot",
		capturedAt: capture.capturedAt,
		category: "news",
		device: capture.device,
		fullImageUrl: capture.fullImageUrl,
		key: capture.key,
		name: `amiabot-${result.profile}`,
		thumbnailUrl: capture.thumbnailUrl,
		triggeredAt: capture.triggeredAt,
		url: result.url,
	};
}

export function BotCheckTool({ apiKey, profiles }: { apiKey: string; profiles: string[] }) {
	const [profile, setProfile] = useState("default");
	const [result, setResult] = useState<BotCheckResult>();
	const [selected, setSelected] = useState<SnapshotGroup>();
	const [status, setStatus] = useState("");
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		setProfile((current) => (profiles.includes(current) ? current : (profiles[0] ?? "default")));
	}, [profiles]);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		setSubmitting(true);
		setResult(undefined);
		setStatus("Running bot detection capture…");

		try {
			const nextResult = await startBotCheck(apiKey, profile);
			setResult(nextResult);
			setStatus("Bot detection capture finished.");
		} catch (reason) {
			setStatus(reason instanceof Error ? reason.message : "Could not run bot detection capture.");
		} finally {
			setSubmitting(false);
		}
	}

	const captures = result
		? result.results.flatMap((capture) => {
				const snapshot = botCheckSnapshot(result, capture);
				return snapshot ? [snapshot] : [];
			})
		: [];
	const captureGroups = groupSnapshotVariants(captures);
	const failures = result?.results.filter((capture) => capture.status === "error") ?? [];

	return (
		<>
			<form className="admin-tool bot-check" onSubmit={submit}>
				<header className="admin-tool__header">
					<h2>Bot detection check</h2>
				</header>

				<label>
					<span>Capture profile</span>
					<select
						disabled={profiles.length === 0 || submitting}
						onChange={(event) => setProfile(event.target.value)}
						value={profile}
					>
						{profiles.map((value) => (
							<option key={value} value={value}>
								{displayName(value)}
							</option>
						))}
					</select>
				</label>

				<button
					className="impact-button"
					disabled={!apiKey || profiles.length === 0 || submitting}
					type="submit"
				>
					{submitting ? "Capturing…" : "Run bot check"}
				</button>

				<p aria-live="polite" className="admin-status">
					{!apiKey && !status ? "Enter the API key above to run this tool." : status}
				</p>

				{captureGroups.length > 0 ? (
					<div className="snapshot-grid bot-check__captures">
						{captureGroups.map((group) => (
							<SnapshotCard
								group={group}
								key={`${group.name}-${group.capturedAt}`}
								onSelect={() => setSelected(group)}
							/>
						))}
					</div>
				) : null}

				{failures.length > 0 ? (
					<ul className="bot-check__results">
						{failures.map((capture) => (
							<li key={capture.device}>
								<strong>{displayName(capture.device)}</strong>
								<span className={`bot-check__status bot-check__status--${capture.status}`}>
									{capture.status}
								</span>
								<span>{capture.error}</span>
							</li>
						))}
					</ul>
				) : null}
			</form>

			{selected ? <SnapshotModal group={selected} onClose={() => setSelected(undefined)} /> : null}
		</>
	);
}
