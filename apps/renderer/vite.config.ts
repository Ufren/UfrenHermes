import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export const viteConfig = defineConfig(({ command }) => ({
  // Electron loads the production renderer with file:// URLs, so built asset
  // paths must stay relative while Vite dev server keeps using root-relative paths.
  base: command === "build" ? "./" : "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src")
    }
  },
  server: {
    host: "127.0.0.1",
    port: 5181,
    strictPort: true
  },
  build: {
    outDir: "dist",
    sourcemap: true
  }
}));

export default viteConfig;
