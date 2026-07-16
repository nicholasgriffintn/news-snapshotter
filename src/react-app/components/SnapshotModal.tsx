import { useEffect } from 'react';

import { displayName, timeLabel } from '../lib/format';
import type { Snapshot } from '../types';

export function SnapshotModal({ onClose, snapshot }: { onClose: () => void; snapshot: Snapshot }) {
	useEffect(() => {
		function closeOnEscape(event: KeyboardEvent) {
			if (event.key === 'Escape') onClose();
		}
		document.body.classList.add('modal-open');
		window.addEventListener('keydown', closeOnEscape);
		return () => {
			document.body.classList.remove('modal-open');
			window.removeEventListener('keydown', closeOnEscape);
		};
	}, [onClose]);

	return (
		<div
			aria-modal="true"
			className="modal"
			onMouseDown={(event) => event.target === event.currentTarget && onClose()}
			role="dialog"
		>
			<div className="modal__panel">
				<header className="modal__header">
					<div>
						<p>
							{displayName(snapshot.brand)} / {snapshot.category}
						</p>
						<h2>{displayName(snapshot.name)}</h2>
						<time dateTime={snapshot.capturedAt}>
							{timeLabel(snapshot.capturedAt)} ·{' '}
							{new Date(snapshot.capturedAt).toLocaleDateString('en-GB')}
						</time>
					</div>
					<button
						aria-label="Close screenshot"
						className="modal__close"
						onClick={onClose}
						type="button"
					>
						×
					</button>
				</header>
				<div className="modal__image">
					<img
						alt={`Full screenshot of ${displayName(snapshot.name)}`}
						src={snapshot.fullImageUrl}
					/>
				</div>
			</div>
		</div>
	);
}
