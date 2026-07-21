import assert from "node:assert/strict";
import test from "node:test";

import react from "@vitejs/plugin-react";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("renders the history controls and card skeletons before site data loads", async () => {
	const server = await createServer({
		appType: "custom",
		configFile: false,
		plugins: [react()],
		server: { middlewareMode: true },
	});

	try {
		const { HistoryIndexPage } = await server.ssrLoadModule(
			"/src/react-app/features/history/HistoryIndexPage.tsx",
		);
		const html = renderToStaticMarkup(
			React.createElement(HistoryIndexPage, { catalogue: new Map() }),
		);

		assert.match(
			html,
			/<input(?=[^>]*disabled)(?=[^>]*placeholder="Search publishers")[^>]*>/,
		);
		assert.equal((html.match(/<select[^>]*disabled/g) ?? []).length, 2);
		assert.equal((html.match(/history-site-card--skeleton/g) ?? []).length, 6);
		assert.match(html, /Loading site histories/);
	} finally {
		await server.close();
	}
});
