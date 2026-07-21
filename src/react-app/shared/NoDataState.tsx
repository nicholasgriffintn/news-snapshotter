import type { ReactNode } from "react";

type NoDataStateProps = {
	action?: ReactNode;
	compact?: boolean;
	description?: ReactNode;
	title: ReactNode;
};

export function NoDataState({ action, compact = false, description, title }: NoDataStateProps) {
	return (
		<div
			aria-live="polite"
			className={`no-data-state${compact ? " no-data-state--compact" : ""}`}
			role="status"
		>
			<span aria-hidden="true" className="no-data-state__icon">
				<svg fill="none" viewBox="0 0 48 48">
					<path d="M8 15h32v25H8z" />
					<path d="M8 29h10l3 5h6l3-5h10" />
					<path d="M16 9h16" />
				</svg>
			</span>
			<div className="no-data-state__copy">
				<span className="no-data-state__label">No data</span>
				<strong className="no-data-state__title">{title}</strong>
				{description ? <p>{description}</p> : null}
			</div>
			{action ? <div className="no-data-state__action">{action}</div> : null}
		</div>
	);
}
