import type { AppPage } from "../../core/app-route";
import { environmentBadge } from "./site-environment";

type SiteHeaderProps = {
	page: AppPage;
};

export function SiteHeader({ page }: SiteHeaderProps) {
	const badge = environmentBadge(import.meta.env.MODE);

	return (
		<header className="masthead">
			<div className="brand-lockup">
				<a
					aria-label={`News Snapshotter home${badge ? ` — ${badge.label} environment` : ""}`}
					className="site-brand"
					href="/"
				>
					<span className="site-brand__icon">
						<img alt="" aria-hidden="true" src="/news-snapshotter-mark.svg" />
						{badge ? (
							<span
								aria-hidden="true"
								className="site-brand__environment"
								data-tone={badge.tone}
								title={`${badge.label} environment`}
							/>
						) : null}
					</span>
					<span className="site-brand__name" aria-hidden="true">
						<strong>News</strong>
						<strong>Snapshotter</strong>
					</span>
				</a>
				<a
					aria-label="News Snapshotter is a Pashi project"
					className="pashi-family"
					href="https://pashi.app"
					target="_blank"
					rel="noopener noreferrer"
				>
					<span>A project by</span>
					<img alt="" aria-hidden="true" src="/pashi-logo.svg" />
					<strong>Pashi</strong>
				</a>
			</div>
			<nav aria-label="Main" className="main-nav">
				<a
					className={page === "archive" ? "active" : ""}
					href="/"
					aria-current={page === "archive" ? "page" : undefined}
				>
					Archive
				</a>
				<a
					className={page === "history" ? "active" : ""}
					href="/history"
					aria-current={page === "history" ? "page" : undefined}
				>
					History
				</a>
			</nav>
		</header>
	);
}
