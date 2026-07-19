import { dispatchCaptureWorkflows } from "./dispatch-workflows.ts";
import { hasCaptureProvider } from "../../capture/adapters/provider-registry.ts";
import { SITES } from "../../catalogue/domain/sites.ts";
import type { CaptureSelection } from "../../../core/contracts.ts";
import type { Env } from "../../../platform/cloudflare/env.ts";
import { selectSites } from "../../catalogue/domain/site-catalogue.ts";
import { InvalidInputError } from "../../../core/errors.ts";

export function parseCaptureSelection(body: unknown): CaptureSelection {
	if (!body || typeof body !== "object" || Array.isArray(body)) {
		throw new InvalidInputError("Request body must be a JSON object");
	}

	const { brand, name, priority, provider } = body as Record<string, unknown>;
	if (brand !== undefined && (typeof brand !== "string" || brand.length === 0)) {
		throw new InvalidInputError("brand must be a non-empty string");
	}
	if (name !== undefined && (typeof name !== "string" || name.length === 0)) {
		throw new InvalidInputError("name must be a non-empty string");
	}
	if (
		priority !== undefined &&
		(typeof priority !== "number" || ![1, 2, 3, 4].includes(priority))
	) {
		throw new InvalidInputError("priority must be 1, 2, 3, or 4");
	}
	if (provider !== undefined && (typeof provider !== "string" || !hasCaptureProvider(provider))) {
		throw new InvalidInputError("provider must be cloudflare or hyperbrowser");
	}

	return {
		brand: brand as CaptureSelection["brand"],
		name: name as CaptureSelection["name"],
		priority: priority as CaptureSelection["priority"],
		provider: provider as CaptureSelection["provider"],
	};
}

export async function startCaptureWorkflow(
	env: Pick<Env, "NEWS_SNAPSHOTTER">,
	selection: CaptureSelection,
) {
	const selectedSites = selectSites(SITES, selection);
	const sites = selection.provider
		? selectedSites.map((site) => ({ ...site, provider: selection.provider }))
		: selectedSites;
	return dispatchCaptureWorkflows(env, sites, new Date().toISOString());
}
