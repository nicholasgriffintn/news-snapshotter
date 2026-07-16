export function displayName(value: string): string {
	return value.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function groupLabel(capturedAt: string): string {
	const date = new Date(capturedAt);
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(today.getDate() - 1);
	const dateKey = date.toDateString();
	const day =
		dateKey === today.toDateString()
			? 'Today'
			: dateKey === yesterday.toDateString()
				? 'Yesterday'
				: new Intl.DateTimeFormat('en-GB', { dateStyle: 'full' }).format(date);

	return `${day} · ${timeLabel(capturedAt)}`;
}

export function timeLabel(capturedAt: string): string {
	return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(capturedAt));
}
