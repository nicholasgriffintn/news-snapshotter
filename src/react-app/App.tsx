import { useState } from "react";

import { resolveAppPage } from "./core/app-route.ts";
import { AdminPage } from "./features/admin/AdminPage";
import { SnapshotGallery } from "./features/archive/SnapshotGallery";
import { ContactModal } from "./features/contact/ContactModal";
import { Disclosure, DisclosureModal } from "./features/legal/Disclosure";
import { LegalPage } from "./features/legal/LegalPage";
import { HistoryRouter } from "./features/history/HistoryRouter";

export default function App() {
	const [contactOpen, setContactOpen] = useState(false);
	const [disclosureOpen, setDisclosureOpen] = useState(false);
	const page = resolveAppPage(window.location.pathname);
	const historySite =
		page === "history" ? decodeURIComponent(window.location.pathname.split("/")[2] ?? "") : "";

	return (
		<main className="shell">
			<header className="masthead">
				<a className="wordmark" href="/">
					<img alt="" aria-hidden="true" src="/pashi-logo.svg" />
					<span>Pashi</span>
				</a>
			</header>

			{page === "archive" ? (
				<section className="hero">
					<div>
						<h1>
							Today’s news.
							<br />
							<em>Captured.</em>
						</h1>
					</div>
					<div className="hero__intro">
						<p>Browse full-page records of the stories, layouts and moments shaping the day.</p>
						<button
							className="hero__disclosure-action"
							onClick={() => setDisclosureOpen(true)}
							type="button"
						>
							About this site
							<span aria-hidden="true">↗</span>
						</button>
					</div>
				</section>
			) : null}

			{page === "admin" ? <AdminPage /> : null}
			{page === "archive" ? (
				<>
					<SnapshotGallery />
					<Disclosure onContact={() => setContactOpen(true)} />
				</>
			) : null}
			{page === "history" ? <HistoryRouter site={historySite} /> : null}
			{page === "privacy" ? (
				<LegalPage kind="privacy" onContact={() => setContactOpen(true)} />
			) : null}
			{page === "terms" ? <LegalPage kind="terms" onContact={() => setContactOpen(true)} /> : null}

			<nav aria-label="Legal and contact" className="legal-nav">
				<a href="/terms">Terms</a>
				<a href="/privacy">Privacy</a>
				<button onClick={() => setContactOpen(true)} type="button">
					Contact
				</button>
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
