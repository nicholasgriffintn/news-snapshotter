import { useId, type ReactNode } from "react";

type FilterPanelProps = {
	ariaLabel: string;
	children: ReactNode;
	className?: string;
};

export function FilterPanel({ ariaLabel, children, className }: FilterPanelProps) {
	return (
		<section aria-label={ariaLabel} className={["filters", className].filter(Boolean).join(" ")}>
			{children}
		</section>
	);
}

type FilterFieldProps = {
	children: ReactNode;
	className?: string;
	htmlFor: string;
	label: ReactNode;
};

export function FilterField({ children, className, htmlFor, label }: FilterFieldProps) {
	return (
		<div className={["filter-field", className].filter(Boolean).join(" ")}>
			<label htmlFor={htmlFor}>{label}</label>
			{children}
		</div>
	);
}

type SearchFieldProps = {
	className?: string;
	disabled?: boolean;
	label?: string;
	maxLength?: number;
	onChange: (value: string) => void;
	placeholder: string;
	value: string;
};

export function SearchField({
	className,
	disabled = false,
	label = "Search",
	maxLength,
	onChange,
	placeholder,
	value,
}: SearchFieldProps) {
	const id = useId();

	return (
		<FilterField
			className={["search-field", className].filter(Boolean).join(" ")}
			htmlFor={id}
			label={label}
		>
			<div className="search-field__control">
				<svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
					<circle cx="11" cy="11" r="7" />
					<path d="m16 16 5 5" />
				</svg>
				<input
					disabled={disabled}
					id={id}
					maxLength={maxLength}
					onChange={(event) => onChange(event.target.value)}
					placeholder={placeholder}
					type="search"
					value={value}
				/>
			</div>
		</FilterField>
	);
}

export type SelectOption = {
	label: ReactNode;
	value: string;
};

type SelectFieldProps = {
	className?: string;
	disabled?: boolean;
	label: ReactNode;
	onChange: (value: string) => void;
	options: readonly SelectOption[];
	value: string;
};

export function SelectField({
	className,
	disabled = false,
	label,
	onChange,
	options,
	value,
}: SelectFieldProps) {
	const id = useId();

	return (
		<FilterField className={className} htmlFor={id} label={label}>
			<select
				disabled={disabled}
				id={id}
				onChange={(event) => onChange(event.target.value)}
				value={value}
			>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</FilterField>
	);
}
