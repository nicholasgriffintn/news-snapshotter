import type { ReactNode } from "react";

type CollectionControlsProps = {
	children: ReactNode;
	summary?: ReactNode;
};

export function CollectionControls({ children, summary }: CollectionControlsProps) {
	return (
		<div className="collection-controls">
			{children}
			{summary}
		</div>
	);
}

type CollectionSummaryProps = {
	action?: ReactNode;
	details?: ReactNode;
	label: ReactNode;
};

export function CollectionSummary({ action, details, label }: CollectionSummaryProps) {
	return (
		<div aria-live="polite" className="collection-summary">
			<div className="collection-summary__copy">
				<strong>{label}</strong>
				{details ? <span>{details}</span> : null}
			</div>
			{action ? <div className="collection-summary__action">{action}</div> : null}
		</div>
	);
}
