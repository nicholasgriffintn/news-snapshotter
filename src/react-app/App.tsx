import { useState } from "react";

import { resolveAppPage } from "./core/app-route.ts";
import { AdminPage } from "./features/admin/AdminPage";
import { SnapshotGallery } from "./features/archive/SnapshotGallery";
import { PageMetadata } from "./features/branding/PageMetadata";
import { ContactModal } from "./features/contact/ContactModal";
import { SiteHeader } from "./features/branding/SiteHeader";
import { Disclosure, DisclosureModal } from "./features/legal/Disclosure";
import { LegalPage } from "./features/legal/LegalPage";
import { HistoryRouter } from "./features/history/HistoryRouter";
import { ComparisonBetaBanner } from "./features/comparison/ComparisonBetaBanner.tsx";
import { ResearchBetaBanner } from "./features/history/ResearchBetaBanner.tsx";
import { ComparisonRouter } from "./features/comparison/ComparisonRouter";
import { Button, ButtonLink } from "./shared/Button.tsx";
import { PageHeader } from "./shared/PageHeaders.tsx";
import { NoDataState } from "./shared/NoDataState.tsx";

export default function App() {
	const [contactOpen, setContactOpen] = useState(false);
	const [disclosureOpen, setDisclosureOpen] = useState(false);
	const page = resolveAppPage(window.location.pathname);
	const historySite =
		page === "history" ? decodeURIComponent(window.location.pathname.split("/")[2] ?? "") : "";
	const historyResource =
		page === "history" ? decodeURIComponent(window.location.pathname.split("/")[3] ?? "") : "";

	return (
		<main className="shell">
			<PageMetadata historySite={historySite} page={page} />
			<SiteHeader page={page} />

			{page === "compare" ? <ComparisonBetaBanner /> : null}

			{page === "history" && historyResource === "research" ? <ResearchBetaBanner /> : null}

			{page === "archive" ? (
				<PageHeader
					aside={
						<Button
							className="page-header__disclosure-action"
							onClick={() => setDisclosureOpen(true)}
							variant="tertiary"
						>
							About this site
							<span aria-hidden="true">↗</span>
						</Button>
					}
					description="Browse full-page records of the content, layouts and moments shaping the day."
					title={
						<>
							Today’s news.
							<br />
							<em>Captured.</em>
						</>
					}
				/>
			) : null}

			{page === "admin" ? <AdminPage /> : null}

			{page === "archive" ? (
				<>
					<SnapshotGallery />
					<Disclosure onContact={() => setContactOpen(true)} />
				</>
			) : null}

			{page === "history" ? <HistoryRouter site={historySite} /> : null}
			{page === "compare" ? <ComparisonRouter /> : null}

			{page === "privacy" ? (
				<LegalPage kind="privacy" onContact={() => setContactOpen(true)} />
			) : null}

			{page === "terms" ? <LegalPage kind="terms" onContact={() => setContactOpen(true)} /> : null}
			{page === "not-found" ? (
				<NoDataState
					action={<ButtonLink href="/">Return to the archive</ButtonLink>}
					description="The requested page does not exist or is no longer available."
					title="Page not found"
				/>
			) : null}

			<nav aria-label="Legal and contact" className="legal-nav">
				<a href="/terms">Terms</a>
				<a href="/privacy">Privacy</a>
				<Button onClick={() => setContactOpen(true)} variant="plain">
					Contact
				</Button>
			</nav>

			<footer>
				<span>
					Built by <a href="https://nicholasgriffin.dev">Nicholas Griffin</a>
				</span>
			</footer>

			{contactOpen ? <ContactModal onClose={() => setContactOpen(false)} /> : null}

			{disclosureOpen ? (
				<DisclosureModal
					onClose={() => setDisclosureOpen(false)}
					onContact={() => {
						setDisclosureOpen(false);
						setContactOpen(true);
					}}
				/>
			) : null}
		</main>
	);
}
