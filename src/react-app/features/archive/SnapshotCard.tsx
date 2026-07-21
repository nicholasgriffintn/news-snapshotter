import { displayName, timeLabel } from "../../shared/format.ts";
import { Badge } from "../../shared/Badge.tsx";
import { ButtonLink } from "../../shared/Button.tsx";
import { Card } from "../../shared/Card.tsx";
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
		<Card className="snapshot-card">
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
					<Badge className={`category category--${group.category}`} tone="accent">
						{group.category}
					</Badge>
				</div>
				<div className="snapshot-card__copy">
					<h3 className="ui-card-title">{title}</h3>
					<span className="ui-card-description--meta">
						{group.url} - {displayName(group.brand)} - <time dateTime={group.capturedAt}>{timeLabel(group.capturedAt)}</time>
					</span>
				</div>
			</button>
			<div className="ui-card-actions">
				{analysed ? (
					<ButtonLink
						href={`/history/${encodeURIComponent(group.name)}`}
						layout="card"
						variant="secondary"
					>
						Explore page history <span aria-hidden="true">→</span>
					</ButtonLink>
				) : null}
			</div>
		</Card>
	);
}
