import { displayName, timeLabel } from "../../shared/format.ts";
import { preferredVariant } from "./domain/snapshot-groups.ts";
import type { SnapshotGroup } from "../../core/types.ts";
import { DeviceIcon } from "./DeviceIcon";

export function SnapshotCard({
	analysed = false,
	group,
	onSelect,
}: {
	analysed?: boolean;
	group: SnapshotGroup;
	onSelect: () => void;
}) {
	const preview = preferredVariant(group);
	const devices = (["desktop", "mobile"] as const).filter((device) => group.variants[device]);
	const title = displayName(group.name, group.displayName);

	return (
		<article className="snapshot-card">
			<button className="snapshot-card__open" onClick={onSelect} type="button">
				<div className="snapshot-card__image">
					<img
						alt={`Thumbnail of ${title}`}
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
					<h3>{title}</h3>
					<span className="snapshot-card__url">{group.url}</span>
					<time dateTime={group.capturedAt}>{timeLabel(group.capturedAt)}</time>
				</div>
			</button>
			{analysed ? (
				<a className="snapshot-card__history" href={`/history/${encodeURIComponent(group.name)}`}>
					Explore page history <span aria-hidden="true">→</span>
				</a>
			) : (
				<span aria-hidden="true" className="snapshot-card__history snapshot-card__history--placeholder">
					Explore page history
				</span>
			)}
		</article>
	);
}
