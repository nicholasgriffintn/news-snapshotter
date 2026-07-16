import { displayName, timeLabel } from '../lib/format';
import type { Snapshot } from '../types';

export function SnapshotCard({ onSelect, snapshot }: { onSelect: () => void; snapshot: Snapshot }) {
	return (
		<button className="snapshot-card" onClick={onSelect} type="button">
			<div className="snapshot-card__image">
				<img
					alt={`Thumbnail of ${displayName(snapshot.name)}`}
					loading="lazy"
					onError={(event) => {
						event.currentTarget.src = snapshot.fullImageUrl;
					}}
					src={snapshot.thumbnailUrl}
				/>
				<span className={`category category--${snapshot.category}`}>{snapshot.category}</span>
			</div>
			<div className="snapshot-card__copy">
				<span className="snapshot-card__brand">
					{displayName(snapshot.brand)} · {snapshot.device}
				</span>
				<h3>{displayName(snapshot.name)}</h3>
				<time dateTime={snapshot.capturedAt}>{timeLabel(snapshot.capturedAt)}</time>
			</div>
		</button>
	);
}
