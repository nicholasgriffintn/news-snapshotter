import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant =
	| "danger"
	| "icon"
	| "plain"
	| "primary"
	| "quiet"
	| "secondary"
	| "tertiary"
	| "text";
type ButtonLayout = "card";

function buttonClassName(
	variant: ButtonVariant,
	layout?: ButtonLayout,
	className?: string,
): string {
	return [
		"ui-button",
		`ui-button--${variant}`,
		layout ? `ui-button--${layout}-action` : null,
		className,
	]
		.filter(Boolean)
		.join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	layout?: ButtonLayout;
	variant?: ButtonVariant;
};

export function Button({
	className,
	layout,
	type = "button",
	variant = "primary",
	...props
}: ButtonProps) {
	return <button {...props} className={buttonClassName(variant, layout, className)} type={type} />;
}

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
	children: ReactNode;
	layout?: ButtonLayout;
	variant?: Exclude<ButtonVariant, "icon">;
};

export function ButtonLink({ className, layout, variant = "primary", ...props }: ButtonLinkProps) {
	return <a {...props} className={buttonClassName(variant, layout, className)} />;
}

type IconButtonProps = Omit<ButtonProps, "aria-label" | "variant"> & {
	label: string;
};

export function IconButton({ label, ...props }: IconButtonProps) {
	return <Button {...props} aria-label={label} variant="icon" />;
}
