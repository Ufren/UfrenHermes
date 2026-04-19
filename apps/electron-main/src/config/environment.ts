import { app } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));

export const appEnvironment = {
  isDev: !app.isPackaged,
  rendererDevUrl: process.env.UFREN_RENDERER_URL ?? "http://127.0.0.1:5181",
  preloadPath: join(currentDir, "..", "preload.js")
};
