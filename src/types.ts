export type SiteCategory = 'news' | 'sport';

export type SiteDefinition = {
	name: string;
	brand: string;
	category: SiteCategory;
	url: string;
	requestBody?: {
		addStyleTag?: string;
	};
};

export type SiteSource = Omit<SiteDefinition, 'brand'>;

export type ScreenshotResult = {
	name: string;
	status: 'success' | 'error';
	key?: string;
	error?: string;
};
