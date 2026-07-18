import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
	lint: {
		rules: {
			curly: ["error", "all"],
		},
	},
	plugins: [react(), cloudflare()],
	server: {
		port: 8787,
	},
});
