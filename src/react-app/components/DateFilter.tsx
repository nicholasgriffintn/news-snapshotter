import { useEffect, useRef, useState } from "react";

import { dateInputValue, type ArchivePeriod } from "../lib/archive-period";

type DateFilterProps = {
	day: string;
	onChange: (period: ArchivePeriod, day?: string) => void;
	period: ArchivePeriod;
};

const PERIOD_OPTIONS: Array<{ label: string; value: ArchivePeriod }> = [
	{ label: "Last 3 hours", value: "last-3-hours" },
	{ label: "Last 24 hours", value: "last-24-hours" },
	{ label: "Yesterday", value: "yesterday" },
];

function selectedLabel(period: ArchivePeriod, day: string): string {
	if (period === "day") {
		return day
			? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
					new Date(`${day}T12:00:00`),
				)
			: "Custom date";
	}

	return PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? "Date";
}

export function DateFilter({ day, onChange, period }: DateFilterProps) {
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const currentDay = dateInputValue(new Date());

	useEffect(() => {
		function closeDropdown(event: PointerEvent) {
			if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
		}

		function closeOnEscape(event: KeyboardEvent) {
			if (event.key === "Escape") setOpen(false);
		}

		document.addEventListener("pointerdown", closeDropdown);
		window.addEventListener("keydown", closeOnEscape);

		return () => {
			document.removeEventListener("pointerdown", closeDropdown);
			window.removeEventListener("keydown", closeOnEscape);
		};
	}, []);

	function choosePeriod(value: ArchivePeriod) {
		onChange(value);
		setOpen(false);
	}

	return (
		<div className="date-filter filter-field" ref={containerRef}>
			<span className="date-filter__label">Date</span>
			<button
				aria-controls="date-filter-popup"
				aria-expanded={open}
				className="date-filter__trigger"
				onClick={() => setOpen((current) => !current)}
				type="button"
			>
				<span>{selectedLabel(period, day)}</span>
				<span aria-hidden="true" className="date-filter__chevron" />
			</button>

			{open ? (
				<div className="date-filter__popup" id="date-filter-popup">
					{PERIOD_OPTIONS.map((option) => (
						<button
							aria-pressed={period === option.value}
							key={option.value}
							onClick={() => choosePeriod(option.value)}
							type="button"
						>
							{option.label}
						</button>
					))}
					<button
						aria-expanded={period === "day"}
						aria-pressed={period === "day"}
						onClick={() => onChange("day", day)}
						type="button"
					>
						Custom
					</button>
					{period === "day" ? (
						<div className="date-filter__calendar">
							<label htmlFor="custom-date">Choose a date</label>
							<input
								id="custom-date"
								max={currentDay}
								onChange={(event) => onChange("day", event.target.value)}
								type="date"
								value={day}
							/>
						</div>
					) : null}
				</div>
			) : null}
		</div>
	);
}
