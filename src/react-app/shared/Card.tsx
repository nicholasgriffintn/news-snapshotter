import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLElement> & {
	as?: "article" | "section";
	children: ReactNode;
};

export function Card({
	as: Element = "article",
	children,
	className,
	...props
}: CardProps) {
	return (
		<Element
			{...props}
			className={["ui-card", className]
				.filter(Boolean)
				.join(" ")}
		>
			{children}
		</Element>
	);
}
