import type { ElementHistory } from "../../core/types.ts";
import { fetchElementHistory } from "../../platform/api-client.ts";

type ElementHistoryLoader = (
	site: string,
	elementKey: string,
	options?: { signal?: AbortSignal },
) => Promise<ElementHistory>;

export async function loadContentComparisonItems(
	site: string,
	elementKeys: readonly string[],
	load: ElementHistoryLoader = fetchElementHistory,
	options?: { signal?: AbortSignal },
): Promise<{ items: ElementHistory[]; unavailableKeys: string[] }> {
	const selectedKeys = [...new Set(elementKeys)].slice(0, 10);
	const results = await Promise.allSettled(
		selectedKeys.map((elementKey) => load(site, elementKey, options)),
	);
	const items: ElementHistory[] = [];
	const unavailableKeys: string[] = [];
	for (const [index, result] of results.entries()) {
		if (result.status === "fulfilled") {
			items.push(result.value);
		} else {
			unavailableKeys.push(selectedKeys[index]);
		}
	}
	return { items, unavailableKeys };
}
