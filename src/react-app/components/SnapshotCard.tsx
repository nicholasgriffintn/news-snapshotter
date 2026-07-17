import { displayName, timeLabel } from "../lib/format";
import { preferredVariant } from "../lib/snapshot-groups";
import type { SnapshotGroup } from "../types";
import { DeviceIcon } from "./DeviceIcon";

export function SnapshotCard({ group, onSelect }: { group: SnapshotGroup; onSelect: () => void }) {
	const preview = preferredVariant(group);
	const devices = (["desktop", "mobile"] as const).filter((device) => group.variants[device]);

	return (
		<button className="snapshot-card" onClick={onSelect} type="button">
			<div className="snapshot-card__image">
				<img
					alt={`Thumbnail of ${displayName(group.name)}`}
					loading="lazy"
					onError={(event) => {
						event.currentTarget.src = preview.fullImageUrl;
					}}
					src={preview.thumbnailUrl}
				/>
				<div aria-label="Captured variants" className="snapshot-card__variants">
					{devices.map((device) => (
						<span aria-label={`${displayName(device)} captured`} key={device}>
							<DeviceIcon device={device} />
						</span>
					))}
				</div>
				<span className={`category category--${group.category}`}>{group.category}</span>
			</div>
			<div className="snapshot-card__copy">
				<span className="snapshot-card__brand">{displayName(group.brand)}</span>
				<h3>{displayName(group.name)}</h3>
				<span className="snapshot-card__url">{group.url}</span>
				<time dateTime={group.capturedAt}>{timeLabel(group.capturedAt)}</time>
			</div>
		</button>
	);
}
