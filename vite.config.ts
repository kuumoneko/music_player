import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite'
import { resolve } from "node:path"


export default defineConfig({
	plugins: [react(), tailwindcss()],
	build: {
		outDir: "./dist",
		emptyOutDir: true,
		rollupOptions: {
			input: {
				mainview: resolve(__dirname, 'src/mainview/index.html'),
				player: resolve(__dirname, 'src/player/index.html')
			},
		},
	},
	server: {
		port: 5173,
		strictPort: true,
	},
	resolve: {
		alias: {
			"@": resolve(__dirname, "src"),
		}
	}
});
