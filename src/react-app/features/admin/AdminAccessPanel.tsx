import { useState } from "react";

type AdminAccessPanelProps = {
	apiKey: string;
	onChange: (apiKey: string) => void;
};

export function AdminAccessPanel({ apiKey, onChange }: AdminAccessPanelProps) {
	const [draft, setDraft] = useState("");

	return (
		<aside className="admin-access" aria-labelledby="admin-access-title">
			<div className="admin-access__heading">
				<div>
					<h2 id="admin-access-title">API key</h2>
				</div>
				<span className={`admin-access__state${apiKey ? " admin-access__state--ready" : ""}`}>
					<span aria-hidden="true" />
					{apiKey ? "Actions enabled" : "Session locked"}
				</span>
			</div>
			<form
				className="admin-key-form"
				onSubmit={(event) => {
					event.preventDefault();
					onChange(draft.trim());
				}}
			>
				<label className="admin-key">
					<span>Enter key</span>
					<input
						autoComplete="off"
						onChange={(event) => setDraft(event.target.value)}
						placeholder="Enter key for this session"
						type="password"
						value={draft}
					/>
				</label>
				<button className="admin-secondary-button" type="submit">
					{apiKey ? "Update key" : "Unlock tools"}
				</button>
				<small>The key stays in memory and is required for every admin action.</small>
			</form>
		</aside>
	);
}
