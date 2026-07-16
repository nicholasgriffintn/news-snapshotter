export type Snapshot = {
	brand: string;
	capturedAt: string;
	category: 'news' | 'sport';
	fullImageUrl: string;
	key: string;
	name: string;
	thumbnailUrl: string;
	url: string;
};

export type CatalogueSite = Pick<Snapshot, 'brand' | 'category' | 'name'>;
