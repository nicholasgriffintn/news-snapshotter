export function displayName(value: string): string {
	return value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const CAPTURE_WINDOW_MS = 5 * 60 * 1_000;

export function captureWindowKey(capturedAt: string): string {
	const timestamp = new Date(capturedAt).getTime();
	return new Date(Math.floor(timestamp / CAPTURE_WINDOW_MS) * CAPTURE_WINDOW_MS).toISOString();
}

export function groupLabel(capturedAt: string): string {
	const date = new Date(capturedAt);
	const windowEnd = new Date(date.getTime() + CAPTURE_WINDOW_MS);
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(today.getDate() - 1);
	const dateKey = date.toDateString();
	const day =
		dateKey === today.toDateString()
			? "Today"
			: dateKey === yesterday.toDateString()
				? "Yesterday"
				: new Intl.DateTimeFormat("en-GB", { dateStyle: "full" }).format(date);

	return `${day} · ${timeLabel(capturedAt)}–${timeLabel(windowEnd.toISOString())}`;
}

export function timeLabel(capturedAt: string): string {
	return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(
		new Date(capturedAt),
	);
}

export function dateTimeLabel(value: string): string {
	return new Intl.DateTimeFormat("en-GB", {
		dateStyle: "medium",
		timeStyle: "medium",
	}).format(new Date(value));
}
