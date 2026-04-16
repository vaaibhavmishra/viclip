import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";
import { resolve } from "path";

export default defineConfig({
	main: {
		plugins: [
			sentryVitePlugin({
				org: "vaibhav-j3",
				project: "viclip-desktop",
				sourcemaps: {
					filesToDeleteAfterUpload: "**/*.js.map",
				},
			}),
		],
		resolve: {
			alias: {
				"@shared": resolve("src/shared"),
			},
		},
		build: {
			sourcemap: true,
		},
	},

	preload: {
		plugins: [
			sentryVitePlugin({
				org: "vaibhav-j3",
				project: "viclip-desktop",
				sourcemaps: {
					filesToDeleteAfterUpload: "**/*.js.map",
				},
			}),
		],
		build: {
			sourcemap: true,
		},
	},

	renderer: {
		resolve: {
			alias: {
				"@renderer": resolve("src/renderer/src"),
				"@shared": resolve("src/shared"),
			},
		},
		build: {
			sourcemap: true,
		},
		plugins: [
			react(),
			tailwindcss(),
			sentryVitePlugin({
				org: "vaibhav-j3",
				project: "viclip-desktop",
				sourcemaps: {
					filesToDeleteAfterUpload: "**/*.js.map",
				},
			}),
		],
	},
});
