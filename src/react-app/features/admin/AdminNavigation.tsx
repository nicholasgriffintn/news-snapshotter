import { ADMIN_TOOL_DETAILS, ADMIN_TOOL_GROUPS, type AdminToolId } from "./admin-tools.ts";

type AdminNavigationProps = {
	activeTool: AdminToolId;
	onChange: (tool: AdminToolId) => void;
};

export function AdminNavigation({ activeTool, onChange }: AdminNavigationProps) {
	return (
		<nav aria-label="Admin tools" className="admin-navigation">
			<p className="admin-navigation__label">Tool directory</p>
			{ADMIN_TOOL_GROUPS.map((group) => (
				<div className="admin-navigation__group" key={group.label}>
					<h2>{group.label}</h2>
					{group.tools.map((tool) => {
						const details = ADMIN_TOOL_DETAILS[tool];
						return (
							<button
								aria-label={details.label}
								aria-controls="admin-workspace-panel"
								aria-current={activeTool === tool ? "page" : undefined}
								key={tool}
								onClick={() => onChange(tool)}
								type="button"
							>
								<span>
									<strong>{details.label}</strong>
									<small>{details.description}</small>
								</span>
							</button>
						);
					})}
				</div>
			))}
		</nav>
	);
}
