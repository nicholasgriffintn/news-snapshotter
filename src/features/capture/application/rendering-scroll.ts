import { type Page } from "@cloudflare/puppeteer";

import type { ProgressiveScrollConfig } from "../domain/scroll-policy.ts";

type ScrollState = {
	height: number;
	viewportHeight: number;
	y: number;
};

type ScrollMode = "auto" | "smooth";

type ScrollRuntime = {
	now?: () => number;
	seed?: number;
	sleep?: (duration: number) => Promise<void>;
};

function nextRandom(seed: number): { seed: number; value: number } {
	const nextSeed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
	return { seed: nextSeed, value: nextSeed / 0x1_0000_0000 };
}

async function measure(page: Page): Promise<ScrollState> {
	return page.evaluate(
		() => {
			type BrowserElement = {
				clientHeight: number;
				clientWidth: number;
				scrollHeight: number;
				scrollTop: number;
			};
			const browser = globalThis as unknown as {
				document: {
					documentElement: BrowserElement;
					querySelectorAll: (selector: string) => ArrayLike<BrowserElement>;
					scrollingElement?: BrowserElement;
				};
				getComputedStyle: (element: BrowserElement) => { overflowY: string };
				innerHeight: number;
				scrollY: number;
				__snapshotterScrollTargetResolved?: boolean;
				__snapshotterScrollTarget?: BrowserElement;
			};
			const documentScroller =
				browser.document.scrollingElement ?? browser.document.documentElement;
			if (!browser.__snapshotterScrollTargetResolved) {
				const documentScrollable =
					documentScroller.scrollHeight - documentScroller.clientHeight >=
					browser.innerHeight * 0.5;
				if (!documentScrollable) {
					browser.__snapshotterScrollTarget = Array.from(browser.document.querySelectorAll("*"))
						.filter((element) => {
							const styles = browser.getComputedStyle(element);
							return (
								/(auto|scroll|hidden|clip)/.test(styles.overflowY) &&
								element.scrollHeight > element.clientHeight + 1 &&
								element.clientHeight >= browser.innerHeight * 0.5
							);
						})
						.sort(
							(left, right) =>
								right.clientWidth * right.clientHeight - left.clientWidth * left.clientHeight,
						)[0];
				}
				browser.__snapshotterScrollTargetResolved = true;
			}
			const target = browser.__snapshotterScrollTarget;
			return {
				height: target?.scrollHeight ?? documentScroller.scrollHeight,
				viewportHeight: target?.clientHeight ?? browser.innerHeight,
				y: target?.scrollTop ?? browser.scrollY,
			};
		},
		{ action: "measure" },
	);
}

async function move(page: Page, top: number, behavior: ScrollMode): Promise<void> {
	await page.evaluate(
		(_command) => {
			const browser = globalThis as unknown as {
				__snapshotterScrollTarget?: {
					scrollTo: (options: { behavior: ScrollMode; top: number }) => void;
				};
				scrollTo: (options: { behavior: ScrollMode; top: number }) => void;
			};
			(browser.__snapshotterScrollTarget ?? browser).scrollTo(_command);
		},
		{ action: "move", behavior, top },
	);
}

export async function progressivelyRenderPage(
	page: Page,
	config: ProgressiveScrollConfig,
	runtime: ScrollRuntime = {},
): Promise<void> {
	const now = runtime.now ?? Date.now;
	const sleep =
		runtime.sleep ?? ((duration) => new Promise((resolve) => setTimeout(resolve, duration)));
	const startedAt = now();
	let seed = runtime.seed ?? 0x51f15e;
	let previous = await measure(page);
	let stalledSteps = 0;

	for (
		let step = 0;
		step < config.maxSteps && now() - startedAt < config.maxDurationMs;
		step += 1
	) {
		const random = nextRandom(seed);
		seed = random.seed;
		const ratio =
			config.viewportRatio.min +
			(config.viewportRatio.max - config.viewportRatio.min) * random.value;
		const bottom = Math.max(0, previous.height - previous.viewportHeight);
		await move(page, Math.min(bottom, previous.y + previous.viewportHeight * ratio), "smooth");
		await sleep(config.minDelayMs + Math.round(config.minDelayMs * random.value));

		const current = await measure(page);
		const pageExpanded = current.height > previous.height;
		const progressed = current.y > previous.y || pageExpanded;
		stalledSteps = progressed ? 0 : stalledSteps + 1;
		if (pageExpanded) await sleep(config.minDelayMs);

		const reachedBottom = current.y + current.viewportHeight >= current.height - 1;
		previous = current;
		if (reachedBottom && !pageExpanded) {
			await sleep(Math.max(config.settleDelayMs, config.minDelayMs * 2));
			const settled = await measure(page);
			if (settled.height <= current.height) break;
			previous = settled;
			stalledSteps = 0;
		}
		if (stalledSteps >= 3) break;
	}

	await move(page, 0, "auto");
	await sleep(config.settleDelayMs);
}
