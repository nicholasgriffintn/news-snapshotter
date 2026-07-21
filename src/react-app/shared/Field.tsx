import type { LabelHTMLAttributes, ReactNode } from "react";

type FieldProps = LabelHTMLAttributes<HTMLLabelElement> & {
	children: ReactNode;
	label: ReactNode;
};

export function Field({ children, className, label, ...props }: FieldProps) {
	return (
		<label {...props} className={["ui-field", className].filter(Boolean).join(" ")}>
			<span>{label}</span>
			{children}
		</label>
	);
}
