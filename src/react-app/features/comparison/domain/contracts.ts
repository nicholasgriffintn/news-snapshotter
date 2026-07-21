export type ComparisonWindow = {
	analysedSites: number;
	capturedSites: number;
	cohortId: string;
	endsAt: string;
	expectedSites: number;
	startsAt: string;
	status: "complete" | "partial" | "suppressed";
	windowId: string;
};

export type ComparisonStorySummary = {
	analysisStatus: "available" | "unavailable";
	confidence: number;
	label: string;
	lastSeenAt: string;
	maxProminence: number;
	publishers: Array<{ displayName: string; site: string }>;
	revisionId: string;
	slug: string;
	sourceCount: number;
	storyId: string;
	summary: string;
	topics: string[];
	windowId: string;
};

export type CoverageGap = {
	analysedSites: number;
	clusterConfidence: number;
	confidence: number;
	expectedSites: number;
	label: string;
	lastSeenAt: string;
	maxProminence: number;
	missingPublishers: Array<{ displayName: string; site: string }>;
	publishers: Array<{ displayName: string; site: string }>;
	revisionId: string;
	slug: string;
	sourceCount: number;
	storyId: string;
	windowId: string;
};

export type ComparisonStoryDetail = {
	commonGround: ComparisonFinding[];
	differences: ComparisonFinding[];
	evidence: Array<{
		archiveUrl: string;
		captureId: string;
		capturedAt: string;
		category?: string;
		displayName: string;
		evidenceId: string;
		headline: string;
		lastSeenAt: string;
		prominence?: string;
		rank: number;
		section?: string;
		site: string;
		summary?: string;
		url?: string;
	}>;
	revision: {
		analysisStatus: "available" | "unavailable";
		confidence: number;
		createdAt: string;
		evidenceCount: number;
		revisionId: string;
		sourceCount: number;
	};
	story: {
		firstSeenAt: string;
		label: string;
		lastSeenAt: string;
		slug: string;
		storyId: string;
		summary: string;
	};
	window: ComparisonWindow;
};

export type ComparisonFinding = {
	evidenceIds: string[];
	statement: string;
};

export type PublisherComparison = {
	cohortId: string;
	displayName: string;
	publisher: {
		cohortObservationCount: number;
		from: string;
		headlineTimeline: Array<{
			captureId: string;
			capturedAt: string;
			headline: string;
			storyId: string;
		}>;
		leadCount: number;
		leadTimeline: Array<{
			captureId: string;
			capturedAt: string;
			headline: string;
			label: string;
			storyId: string;
		}>;
		observationCount: number;
		timings: Array<{
			captureId: string;
			direction: "earlier" | "later" | "same-window";
			label: string;
			peerFirstSeenAt: string;
			publisherFirstSeenAt: string;
			storyId: string;
		}>;
		to: string;
		topics: Array<{
			cohortObservationCount: number;
			publisherShare: number;
			publisherObservationCount: number;
			topic: string;
		}>;
		weightedProminenceHours: number;
	};
	site: string;
};
