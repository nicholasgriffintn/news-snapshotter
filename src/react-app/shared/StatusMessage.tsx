import type { ReactNode } from "react";

type StatusMessageProps = {
	children: ReactNode;
	compact?: boolean;
	role?: "alert" | "status";
	tone?: "neutral" | "error" | "info" | "success";
};

export function StatusMessage({
	children,
	compact = false,
	role,
	tone = "neutral",
}: StatusMessageProps) {
	const className = [
		"status-message",
		`status-message--${tone}`,
		compact ? "status-message--compact" : "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div aria-live={role === "status" ? "polite" : undefined} className={className} role={role}>
			{children}
		</div>
	);
}
