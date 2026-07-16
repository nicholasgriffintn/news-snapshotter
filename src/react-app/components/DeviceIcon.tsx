import type { Snapshot } from '../types';

export function DeviceIcon({ device }: { device: Snapshot['device'] }) {
	return device === 'desktop' ? (
		<svg aria-hidden="true" viewBox="0 0 24 24">
			<rect height="13" rx="1" width="20" x="2" y="3" />
			<path d="M8 21h8M12 16v5" />
		</svg>
	) : (
		<svg aria-hidden="true" viewBox="0 0 24 24">
			<rect height="20" rx="2" width="12" x="6" y="2" />
			<path d="M10 18h4" />
		</svg>
	);
}
