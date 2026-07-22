import { useRef, useState } from "react";

import { validateAdminCredential } from "../../platform/api-client.ts";
import { Button } from "../../shared/Button.tsx";

type AdminAccessPanelProps = {
	apiKey: string;
	onChange: (apiKey: string) => void;
};

export function AdminAccessPanel({ apiKey, onChange }: AdminAccessPanelProps) {
	const [draft, setDraft] = useState("");
	const [error, setError] = useState("");
	const [validating, setValidating] = useState(false);
	const request = useRef(0);

	async function validate(event: React.FormEvent): Promise<void> {
		event.preventDefault();
		const candidate = draft.trim();
		if (!candidate) {
			setError("Enter an API key.");
			return;
		}
		const current = ++request.current;
		setError("");
		setValidating(true);
		try {
			await validateAdminCredential(candidate);
			if (request.current === current) {
				onChange(candidate);
			}
		} catch {
			if (request.current === current) {
				setError("The API key could not be validated.");
			}
		} finally {
			if (request.current === current) {
				setValidating(false);
			}
		}
	}

	return (
		<aside className="admin-access" aria-labelledby="admin-access-title">
			<div className="admin-access__heading">
				<div>
					<h2 id="admin-access-title">API key</h2>
				</div>
				<span className={`admin-access__state${apiKey ? " admin-access__state--ready" : ""}`}>
					<span aria-hidden="true" />
					{validating ? "Validating key" : apiKey ? "Actions enabled" : "Session locked"}
				</span>
			</div>
			<form className="admin-key-form" onSubmit={(event) => void validate(event)}>
				<label className="admin-key">
					<span>Enter key</span>
					<input
						autoComplete="off"
						disabled={validating}
						onChange={(event) => setDraft(event.target.value)}
						placeholder="Enter key for this session"
						type="password"
						value={draft}
					/>
				</label>
				<Button disabled={validating} type="submit" variant="secondary">
					{validating ? "Validating…" : apiKey ? "Update key" : "Unlock tools"}
				</Button>
				{apiKey ? (
					<Button
						onClick={() => {
							request.current += 1;
							setDraft("");
							setError("");
							setValidating(false);
							onChange("");
						}}
						type="button"
						variant="quiet"
					>
						Lock tools
					</Button>
				) : null}
				{error ? <small role="alert">{error}</small> : null}
				<small>The key stays in memory and is required for every admin action.</small>
			</form>
		</aside>
	);
}
