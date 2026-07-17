import type { CaptureRegion } from "./types";

export type CaptureRegionConfig = {
	acceptLanguage: string;
	geolocation?: {
		accuracy: number;
		latitude: number;
		longitude: number;
	};
	timezone: string;
};

export const CAPTURE_REGIONS: Record<CaptureRegion, CaptureRegionConfig> = {
	international: {
		acceptLanguage: "en;q=0.9",
		timezone: "UTC",
	},
	uk: {
		acceptLanguage: "en-GB,en;q=0.9",
		geolocation: {
			accuracy: 20,
			latitude: 51.5074,
			longitude: -0.1278,
		},
		timezone: "Europe/London",
	},
	us: {
		acceptLanguage: "en-US,en;q=0.9",
		geolocation: {
			accuracy: 20,
			latitude: 40.7128,
			longitude: -74.006,
		},
		timezone: "America/New_York",
	},
};
