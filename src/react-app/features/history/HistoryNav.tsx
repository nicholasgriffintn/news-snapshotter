export function HistoryNav({
	current,
	site,
}: {
	current: "captures" | "research" | "sites";
	site?: string;
}) {
	return (
		<nav aria-label="History" className="history-nav">
			<a aria-current={current === "sites" ? "page" : undefined} href="/history">
				All sites
			</a>
			{site ? (
				<>
					<a
						aria-current={current === "captures" ? "page" : undefined}
						href={`/history/${encodeURIComponent(site)}`}
					>
						Captures
					</a>
					<a
						aria-current={current === "research" ? "page" : undefined}
						href={`/history/${encodeURIComponent(site)}/research`}
					>
						Research
					</a>
				</>
			) : null}
		</nav>
	);
}
