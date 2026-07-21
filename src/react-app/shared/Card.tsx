import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLElement> & {
	actionsAtBottom?: boolean;
	as?: "article" | "section";
	children: ReactNode;
};

export function Card({
	actionsAtBottom = false,
	as: Element = "article",
	children,
	className,
	...props
}: CardProps) {
	return (
		<Element
			{...props}
			className={["ui-card", actionsAtBottom ? "ui-card--actions-bottom" : null, className]
				.filter(Boolean)
				.join(" ")}
		>
			{children}
		</Element>
	);
}
