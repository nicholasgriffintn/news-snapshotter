export type Env = Cloudflare.Env & {
	ARCHIVE_DATA: R2Bucket;
	API_KEY: string;
};
