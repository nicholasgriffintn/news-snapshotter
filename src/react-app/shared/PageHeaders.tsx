import type { ReactNode } from "react";

import { Breadcrumbs } from "./Breadcrumbs.tsx";

type PageHeaderProps = {
	aside?: ReactNode;
	description?: ReactNode;
	title: ReactNode;
	variant?: "display" | "detail";
	breadcrumbs?: { href?: string; label: string }[];
};

export function PageHeader({ aside, description, title, variant = "display", breadcrumbs }: PageHeaderProps) {
	const intro =
		variant === "display" && (description || aside) ? (
			<div className="page-header__intro">
				{description ? <p className="page-header__description">{description}</p> : null}
				{aside ? <div className="page-header__aside">{aside}</div> : null}
			</div>
		) : null;

	return (
		<header className={`page-header page-header--${variant}`}>
			{breadcrumbs ? (
				<div className="page-header__breadcrumbs">
					<Breadcrumbs ariaLabel="Section" items={breadcrumbs} />
				</div>
			) : null}
			<div className="page-header__contents">
				<div className="page-header__copy">
					<h1 className="page-header__title">{title}</h1>
					{variant === "detail" && description ? (
						<p className="page-header__description">{description}</p>
					) : null}
				</div>
				{intro}
				{variant === "detail" && aside ? <div className="page-header__aside">{aside}</div> : null}
			</div>
		</header>
	);
}

type SectionHeaderProps = {
	aside?: ReactNode;
	description?: ReactNode;
	title: ReactNode;
};

export function SectionHeader({ aside, description, title }: SectionHeaderProps) {
	return (
		<header className="section-header">
			<div className="section-header__copy">
				<h2 className="section-header__title">{title}</h2>
				{description ? <p className="section-header__description">{description}</p> : null}
			</div>
			{aside ? <div className="section-header__aside">{aside}</div> : null}
		</header>
	);
}
