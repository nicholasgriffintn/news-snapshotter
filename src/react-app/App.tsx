import { useState } from "react";

import { AdminPage } from "./components/AdminPage";
import { ContactModal } from "./components/ContactModal";
import { Disclosure, DisclosureModal } from "./components/Disclosure";
import { LegalPage } from "./components/LegalPage";
import { SnapshotGallery } from "./components/SnapshotGallery";

type Page = "admin" | "archive" | "privacy" | "terms";

function currentPage(): Page {
	const path = window.location.pathname;
	if (path === "/admin" || path.startsWith("/admin/")) return "admin";
	if (path === "/privacy" || path.startsWith("/privacy/")) return "privacy";
	if (path === "/terms" || path.startsWith("/terms/")) return "terms";
	return "archive";
}

export default function App() {
	const [contactOpen, setContactOpen] = useState(false);
	const [disclosureOpen, setDisclosureOpen] = useState(false);
	const page = currentPage();
	const isApplicationPage = page === "admin" || page === "archive";

	return (
		<main className="shell">
			<header className="masthead">
				<a className="wordmark" href="/">
					<img alt="" aria-hidden="true" src="/pashi-logo.svg" />
					<span>Pashi</span>
				</a>
			</header>

			{isApplicationPage ? (
				<section className="hero">
					<div>
						{page === "archive" ? <p className="eyebrow">The front page, frozen in time</p> : null}
						<h1>
							{page === "admin" ? (
								<>
									Run the
									<br />
									<em>press.</em>
								</>
							) : (
								<>
									Today’s news.
									<br />
									<em>Captured.</em>
								</>
							)}
						</h1>
					</div>
					<div className="hero__intro">
						{page === "archive" ? (
							<p>Browse full-page records of the stories, layouts and moments shaping the day.</p>
						) : null}
						{page === "archive" ? (
							<button
								className="hero__disclosure-action"
								onClick={() => setDisclosureOpen(true)}
								type="button"
							>
								About this site
								<span aria-hidden="true">↗</span>
							</button>
						) : null}
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
