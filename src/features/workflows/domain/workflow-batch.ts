import type { SiteDefinition } from "../../../core/domain.ts";

const MAX_RUNNERS = 6;
const SITES_PER_RUNNER = 10;

export type WorkflowShard = {
	sites: SiteDefinition[];
	startDelaySeconds: number;
};

export function createWorkflowShards(sites: SiteDefinition[]): WorkflowShard[] {
	if (sites.length === 0) return [];

	const runnerCount = Math.min(MAX_RUNNERS, Math.ceil(sites.length / SITES_PER_RUNNER));
	const shards = Array.from(
		{ length: runnerCount },
		(_, index): WorkflowShard => ({
			sites: [],
			startDelaySeconds: index,
		}),
	);

	for (const [index, site] of sites.entries()) {
		shards[index % runnerCount].sites.push(site);
	}

	return shards;
}
