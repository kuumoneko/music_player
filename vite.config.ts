import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite'
import { resolve } from "node:path"


export default defineConfig({
	plugins: [react({ exclude: "assets/favicon.ico" }), tailwindcss()],
	root: "src/mainview",
	build: {
		outDir: "../../dist",
		emptyOutDir: true,
	},
	server: {
		port: 5173,
		strictPort: true,
	},
	resolve: {
		alias: {
			"@": resolve(__dirname, "src", "mainview"),
		}
	}
});
