type BreadcrumbItem = {
	href?: string;
	label: string;
};

type BreadcrumbsProps = {
	ariaLabel?: string;
	items: readonly BreadcrumbItem[];
};

export function Breadcrumbs({ ariaLabel = "Breadcrumb", items }: BreadcrumbsProps) {
	return (
		<nav aria-label={ariaLabel} className="breadcrumbs">
			<ol>
				{items.map((item, index) => {
					const current = index === items.length - 1;
					return (
						<li key={`${item.label}-${index}`}>
							{item.href && !current ? (
								<a href={item.href}>{item.label}</a>
							) : (
								<span aria-current={current ? "page" : undefined}>{item.label}</span>
							)}
						</li>
					);
				})}
			</ol>
		</nav>
	);
}
