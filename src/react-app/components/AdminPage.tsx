import { useEffect, useMemo, useState } from 'react';

import { fetchCatalogue, startSnapshotWorkflow } from '../lib/api';
import { displayName } from '../lib/format';
import type { CatalogueSite } from '../types';
import { BotCheckTool } from './BotCheckTool';

type Scope = 'all' | 'brand' | 'site';

export function AdminPage() {
	const [apiKey, setApiKey] = useState('');
	const [catalogue, setCatalogue] = useState<CatalogueSite[]>([]);
	const [scope, setScope] = useState<Scope>('all');
	const [brand, setBrand] = useState('bbc');
	const [name, setName] = useState('bbc-news');
	const [status, setStatus] = useState('');
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		fetchCatalogue()
			.then(setCatalogue)
			.catch(() => setStatus('Could not load the site catalogue.'));
	}, []);

	const brands = useMemo(() => {
		return [...new Set(catalogue.map((site) => site.brand))].sort();
	}, [catalogue]);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		setSubmitting(true);
		setStatus('Starting workflow…');

		try {
			const selection = scope === 'brand' ? { brand } : scope === 'site' ? { name } : {};
			const result = await startSnapshotWorkflow(apiKey, selection);
			const plural = result.selectedSites.length === 1 ? '' : 's';
			setStatus(
				`Workflow ${result.workflowId} started for ${result.selectedSites.length} site${plural}.`,
			);
		} catch (reason) {
			setStatus(reason instanceof Error ? reason.message : 'Could not start workflow.');
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<section className="admin-panel">
			<form onSubmit={submit}>
				<label>
					<span>API key</span>
					<input
						autoComplete="off"
						onChange={(event) => setApiKey(event.target.value)}
						placeholder="Enter API key"
						required
						type="password"
						value={apiKey}
					/>
				</label>

				<fieldset>
					<legend>Capture scope</legend>
					<div className="scope-picker">
						{(['all', 'brand', 'site'] as Scope[]).map((value) => (
							<label key={value}>
								<input
									checked={scope === value}
									name="scope"
									onChange={() => setScope(value)}
									type="radio"
								/>
								<span>{displayName(value)}</span>
							</label>
						))}
					</div>
				</fieldset>

				{scope === 'brand' ? (
					<label>
						<span>Brand</span>
						<select onChange={(event) => setBrand(event.target.value)} value={brand}>
							{brands.map((value) => (
								<option key={value} value={value}>
									{displayName(value)}
								</option>
							))}
						</select>
					</label>
				) : null}

				{scope === 'site' ? (
					<label>
						<span>Site</span>
						<select onChange={(event) => setName(event.target.value)} value={name}>
							{catalogue.map((site) => (
								<option key={site.name} value={site.name}>
									{displayName(site.name)} · {site.category}
								</option>
							))}
						</select>
					</label>
				) : null}

				<button className="impact-button" disabled={submitting} type="submit">
					{submitting ? 'Starting…' : 'Start capture'}
				</button>
				<p aria-live="polite" className="admin-status">
					{status}
				</p>
			</form>

			<BotCheckTool apiKey={apiKey} />
		</section>
	);
}
