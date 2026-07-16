import { AdminPage } from './components/AdminPage';
import { SnapshotGallery } from './components/SnapshotGallery';

export default function App() {
	const isAdmin =
		window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');

	return (
		<main className="shell">
			<header className="masthead">
				<a className="wordmark" href="/">
					<img alt="" aria-hidden="true" src="/pashi-logo.svg" />
					<span>Pashi</span>
				</a>
				<nav aria-label="Primary navigation">
					<a aria-current={!isAdmin ? 'page' : undefined} href="/">
						Archive
					</a>
					<a aria-current={isAdmin ? 'page' : undefined} href="/admin">
						Admin
					</a>
				</nav>
			</header>

			<section className="hero">
				<div>
					<p className="eyebrow">The front page, frozen in time</p>
					<h1>
						{isAdmin ? (
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
				<p>
					{isAdmin
						? 'Choose every publication, one brand, or a single page. The workflow handles the rest.'
						: 'Browse full-page records of the stories, layouts and moments shaping the day.'}
				</p>
			</section>

			{isAdmin ? <AdminPage /> : <SnapshotGallery />}

			<footer>
				<span>
					Built by{' '}
					<a href="https://nicholasgriffin.dev">Nicholas Griffin</a>
				</span>
			</footer>
		</main>
	);
}
