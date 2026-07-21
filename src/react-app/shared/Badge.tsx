import type { HTMLAttributes, ReactNode } from "react";

type BadgeProps = HTMLAttributes<HTMLElement> & {
	as?: "li" | "small" | "span";
	children: ReactNode;
	tone?: "accent" | "neutral" | "warning";
};

export function Badge({
	as: Element = "span",
	children,
	className,
	tone = "neutral",
	...props
}: BadgeProps) {
	return (
		<Element
			{...props}
			className={["ui-badge", `ui-badge--${tone}`, className].filter(Boolean).join(" ")}
		>
			{children}
		</Element>
	);
}
