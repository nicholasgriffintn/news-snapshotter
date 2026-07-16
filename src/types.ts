export type SiteCategory = 'news' | 'sport';
export type Device = 'desktop' | 'mobile';

export type SiteDefinition = {
	name: string;
	brand: string;
	category: SiteCategory;
	profile?: string;
	url: string;
	requestBody?: {
		addStyleTag?: string;
	};
};

export type SiteSource = Omit<SiteDefinition, 'brand'>;

export type ScreenshotResult = {
	device: Device;
	name: string;
	status: 'success' | 'error';
	key?: string;
	error?: string;
	failureKey?: string;
};

export type ScreenshotSummary = {
	brand: string;
	capturedAt: string;
	category: SiteCategory;
	device: Device;
	fullImageUrl: string;
	key: string;
	name: string;
	thumbnailUrl: string;
	url: string;
};
