import { useState } from "react";

import { displayName, timeLabel } from "../../shared/format.ts";
import { Dialog, DialogCloseButton } from "../../shared/Dialog.tsx";
import { preferredVariant } from "./domain/snapshot-groups.ts";
import type { Snapshot, SnapshotGroup } from "../../core/types.ts";
import { DeviceIcon } from "./DeviceIcon";

export function SnapshotModal({ group, onClose }: { group: SnapshotGroup; onClose: () => void }) {
	const initialDevice = preferredVariant(group).device;
	const [device, setDevice] = useState<Snapshot["device"]>(initialDevice);
	const devices = (["desktop", "mobile"] as const).filter((candidate) => group.variants[candidate]);
	const snapshot = group.variants[device] ?? preferredVariant(group);
	const title = displayName(group.name, group.displayName);

	function selectAdjacentDevice(event: React.KeyboardEvent, currentIndex: number) {
		if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
			return;
		}
		event.preventDefault();
		const direction = event.key === "ArrowRight" ? 1 : -1;
		const nextIndex = (currentIndex + direction + devices.length) % devices.length;
		setDevice(devices[nextIndex]);
	}

	return (
		<Dialog
			labelledBy="snapshot-modal-title"
			onClose={onClose}
			panelClassName={devices.length > 1 ? "modal__panel--variants" : undefined}
		>
			<header className="modal__header">
				<div>
					<p>
						{displayName(group.brand)} / {group.category}
					</p>
					<h2 id="snapshot-modal-title">{title}</h2>
					<time dateTime={group.capturedAt}>
						{timeLabel(group.capturedAt)} · {new Date(group.capturedAt).toLocaleDateString("en-GB")}
					</time>
					<a className="modal__source" href={group.url} rel="noreferrer" target="_blank">
						<span>{group.url}</span>
						<strong>Visit the original publisher ↗</strong>
					</a>
				</div>
				<DialogCloseButton label="Close screenshot" onClose={onClose} />
			</header>

			{devices.length > 1 ? (
				<div aria-label="Screenshot variant" className="modal__variants" role="tablist">
					{devices.map((candidate, index) => (
						<button
							aria-selected={snapshot.device === candidate}
							key={candidate}
							onClick={() => setDevice(candidate)}
							onKeyDown={(event) => selectAdjacentDevice(event, index)}
							role="tab"
							type="button"
						>
							<DeviceIcon device={candidate} />
							{displayName(candidate)}
						</button>
					))}
				</div>
			) : null}

			<div className={`modal__image modal__image--${snapshot.device}`} role="tabpanel">
				<img
					alt={`Full ${snapshot.device} screenshot of ${title}`}
					key={snapshot.key}
					src={snapshot.fullImageUrl}
				/>
			</div>
		</Dialog>
	);
}
