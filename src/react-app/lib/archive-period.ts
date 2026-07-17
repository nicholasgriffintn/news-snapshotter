export type ArchivePeriod = "last-3-hours" | "last-24-hours" | "yesterday" | "day";

export type ArchivePeriodFilter = {
	day: string;
	period: ArchivePeriod;
};

export const DEFAULT_ARCHIVE_PERIOD: ArchivePeriodFilter = {
	day: "",
	period: "last-3-hours",
};

function isSameLocalDay(left: Date, right: Date): boolean {
	return (
		left.getFullYear() === right.getFullYear() &&
		left.getMonth() === right.getMonth() &&
		left.getDate() === right.getDate()
	);
}

export function dateInputValue(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function matchesArchivePeriod(
	capturedAt: string,
	filter: ArchivePeriodFilter,
	now = new Date(),
): boolean {
	const captured = new Date(capturedAt);
	if (Number.isNaN(captured.getTime()) || captured > now) return false;

	switch (filter.period) {
		case "last-3-hours":
			return (
				isSameLocalDay(captured, now) && captured.getTime() >= now.getTime() - 3 * 60 * 60 * 1_000
			);
		case "last-24-hours":
			return captured.getTime() >= now.getTime() - 24 * 60 * 60 * 1_000;
		case "yesterday": {
			const yesterday = new Date(now);
			yesterday.setDate(now.getDate() - 1);
			return isSameLocalDay(captured, yesterday);
		}
		case "day":
			return Boolean(filter.day) && dateInputValue(captured) === filter.day;
	}
}

export function periodDescription(filter: ArchivePeriodFilter): string {
	switch (filter.period) {
		case "last-3-hours":
			return "Today · last 3 hours";
		case "last-24-hours":
			return "Rolling 24 hours";
		case "yesterday":
			return "Yesterday";
		case "day":
			return filter.day
				? new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(
						new Date(`${filter.day}T12:00:00`),
					)
				: "Choose a day";
	}
}
