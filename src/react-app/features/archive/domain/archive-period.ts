export type ArchivePeriod = "last-3-hours" | "last-24-hours" | "yesterday" | "day";

export type ArchivePeriodFilter = {
	day: string;
	period: ArchivePeriod;
};

export const DEFAULT_ARCHIVE_PERIOD: ArchivePeriodFilter = {
	day: "",
	period: "last-3-hours",
};

function localDayBounds(day: string): { end: Date; start: Date } | undefined {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
		return undefined;
	}
	const start = new Date(`${day}T00:00:00`);
	if (Number.isNaN(start.getTime()) || dateInputValue(start) !== day) {
		return undefined;
	}
	const end = new Date(start);
	end.setDate(end.getDate() + 1);
	end.setMilliseconds(end.getMilliseconds() - 1);
	return { end, start };
}

function archivePeriodBounds(
	filter: ArchivePeriodFilter,
	now: Date,
): { end: Date; start: Date } | undefined {
	switch (filter.period) {
		case "last-3-hours": {
			const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			return {
				end: now,
				start: new Date(Math.max(startOfToday.getTime(), now.getTime() - 3 * 60 * 60 * 1_000)),
			};
		}
		case "last-24-hours":
			return { end: now, start: new Date(now.getTime() - 24 * 60 * 60 * 1_000) };
		case "yesterday": {
			const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			const start = new Date(startOfToday);
			start.setDate(start.getDate() - 1);
			const end = new Date(startOfToday.getTime() - 1);
			return { end, start };
		}
		case "day":
			return localDayBounds(filter.day);
	}
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
	if (Number.isNaN(captured.getTime()) || captured > now) {
		return false;
	}
	const bounds = archivePeriodBounds(filter, now);
	return Boolean(
		bounds && captured.getTime() >= bounds.start.getTime() && captured.getTime() <= bounds.end.getTime(),
	);
}

export function archiveStorageDates(filter: ArchivePeriodFilter, now = new Date()): string[] {
	const bounds = archivePeriodBounds(filter, now);
	if (!bounds) {
		return [];
	}

	const cursor = new Date(
		Date.UTC(bounds.start.getUTCFullYear(), bounds.start.getUTCMonth(), bounds.start.getUTCDate()),
	);
	cursor.setUTCDate(cursor.getUTCDate() - 1);
	const end = Date.UTC(bounds.end.getUTCFullYear(), bounds.end.getUTCMonth(), bounds.end.getUTCDate());
	const dates: string[] = [];
	while (cursor.getTime() <= end) {
		dates.push(cursor.toISOString().slice(0, 10));
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}
	return dates;
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
