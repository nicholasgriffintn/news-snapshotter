import puppeteer from '@cloudflare/puppeteer';

export default {
	async fetch(request, env) {
		let id = env.BROWSER.idFromName('browser');
		let obj = env.BROWSER.get(id);

		// Send a request to the Durable Object, then await its response.
		let resp = await obj.fetch(request.url);

		return resp;
	},
};

const KEEP_BROWSER_ALIVE_IN_SECONDS = 60;

export class Browser {
	constructor(state, env) {
		this.state = state;
		this.env = env;
		this.keptAliveInSeconds = 0;
		this.storage = this.state.storage;
	}

	async fetch() {
		const folder = this.createFolderStructure();

		if (!this.browser || !this.browser.isConnected()) {
			this.browser = await this.launchBrowser(this.env);
		}

		this.keptAliveInSeconds = 0;

		if (this.browser) {
			await this.takeScreenshots(this.browser, this.env, folder);
		}

		this.keptAliveInSeconds = 0;

		let currentAlarm = await this.storage.getAlarm();
		if (currentAlarm == null) {
			console.log(`Browser DO: setting alarm`);
			const TEN_SECONDS = 10 * 1000;
			await this.storage.setAlarm(Date.now() + TEN_SECONDS);
		}

		return new Response('success');
	}

	createFolderStructure() {
		const nowDate = new Date();
		const coeff = 1000 * 60 * 5;
		const roundedDate = new Date(Math.round(nowDate.getTime() / coeff) * coeff).toString();
		const folderDate = roundedDate.split(' GMT')[0];
		return 'screenshots/' + folderDate;
	}

	async launchBrowser(env) {
		console.log(`Browser DO: Starting new instance`);
		try {
			return await puppeteer.launch(env.MYBROWSER);
		} catch (e) {
			console.log(`Browser DO: Could not start browser instance. Error: ${e}`);
			return null;
		}
	}

	async setAttribute(page, name, attributeName, attributeValue) {
		const element = await page.$(name);
		if (element) {
			element.evaluate(
				(node, { n, v }) => {
					node.setAttribute(n, v);
				},
				{ n: attributeName, v: attributeValue }
			);
		}
	}

	async setDisplayNone(page, name) {
		await this.setAttribute(page, name, 'style', 'display: none !important;');
	}

	async clickButton(page, name) {
		const element = await page.$(name);
		if (element) {
			await page.$eval(name, (elem) => elem.click());
		}
	}

	async sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	async cleanSite(site, page) {
		switch (site) {
			case 'https://www.theguardian.com/uk':
				await this.setDisplayNone(page, '#notice');
				await this.clickButton(page, 'button.sp_choice_type_11');
				await this.sleep(500);
				break;
			case 'https://www.itv.com/news':
				await this.setDisplayNone(page, '#cassie-widget');
				await this.clickButton(page, 'button.cassie-pre-banner--button.cassie-accept-all');
				await this.sleep(500);
				break;
			case 'https://bbc.co.uk/news/':
				await this.setDisplayNone(page, '.ssrcss-darju4-ConsentBanner');
				await this.sleep(100);
				break;
			case 'https://news.sky.com/':
				await this.setDisplayNone(page, '#notice');
				await this.clickButton(page, 'button.sp_choice_type_11');
				await this.sleep(500);
				break;
			default:
				break;
		}
	}

	async scrollToBottom(page) {
		await page.evaluate(async () => {
			await new Promise((resolve) => {
				let totalHeight = 0;
				const distance = 100;
				const t = setInterval(() => {
					const { scrollHeight } = document.body;
					// eslint-disable-next-line no-restricted-globals
					scrollBy(0, distance);
					totalHeight += distance;
					if (totalHeight >= scrollHeight) {
						clearInterval(t);
						resolve(true);
					}
				}, 10);
				setTimeout(() => {
					clearInterval(t);
					resolve(false);
				}, 1000 * 1);
			});
		});
	}

	async takeScreenshots(browser, env, folder) {
		const width = [1920];
		const height = [1080];
		const sites = [
			'https://bbc.co.uk/news/',
			'https://www.theguardian.com/uk',
			'https://www.itv.com/news',
			'https://news.sky.com/',
			'https://metro.co.uk',
			'https://dailymail.co.uk',
		];

		const page = await browser.newPage();

		for (let i = 0; i < width.length; i++) {
			await page.setViewport({ width: width[i], height: height[i] });
			for (let j = 0; j < sites.length; j++) {
				console.log(`Browser DO: Taking screenshot of ${sites[j]} at ${width[i]}x${height[i]}`);

				await page.goto(sites[j]);

				await this.cleanSite(sites[j], page);
				await this.scrollToBottom(page);

				const encodedSite = sites[j].replace(/[^a-zA-Z0-9]/g, '_');
				const fileName = 'screenshot_' + width[i] + 'x' + height[i] + '_' + encodedSite;
				const sc = await page.screenshot({ path: fileName + '.jpg' });

				await env.BUCKET.put(folder + '/' + fileName + '.jpg', sc);
			}
		}

		await page.close();
	}

	async extendBrowserLife(storage, keptAliveInSeconds) {
		console.log(`Browser DO: has been kept alive for ${keptAliveInSeconds} seconds. Extending lifespan.`);
		await storage.setAlarm(Date.now() + 10 * 1000);
	}

	async closeBrowser(browser) {
		if (browser) {
			console.log(`Closing browser.`);
			await browser.close();
		}
	}

	async alarm() {
		this.keptAliveInSeconds += 10;

		// Extend browser DO life
		if (this.keptAliveInSeconds < KEEP_BROWSER_ALIVE_IN_SECONDS) {
			await this.extendBrowserLife(this.storage, this.keptAliveInSeconds);
		} else {
			console.log(`Browser DO: exceeded life of ${KEEP_BROWSER_ALIVE_IN_SECONDS}s.`);
			await this.closeBrowser(this.browser);
		}
	}
}
