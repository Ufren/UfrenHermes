import { app, BrowserWindow, ipcMain, Tray, Menu, shell } from "electron";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { installerContextSchema, ipcChannels, ufrenBrand } from "@ufren/shared";

import { ChatService } from "./chat/chat-service.js";
import { DashboardService } from "./dashboard/dashboard-service.js";
import { appEnvironment } from "./config/environment.js";
import { registerAppLogsHandlers } from "./ipc/app-logs-handlers.js";
import { registerChatHandlers } from "./ipc/chat-handlers.js";
import { registerDashboardHandlers } from "./ipc/dashboard-handlers.js";
import { registerInstallerHandlers } from "./ipc/installer-handlers.js";
import { registerRuntimeHandlers } from "./ipc/runtime-handlers.js";
import { InstallerService } from "./installer/installer-service.js";
import { createLogger, initializeLogger } from "./logging/logger.js";
import { RuntimeService } from "./runtime/runtime-service.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
let tray: Tray | null = null;
let isQuitting = false;
const mainLogger = createLogger("main");

function resolveWindowIconPath(): string | undefined {
  const candidates = [
    join(process.cwd(), "resources", "icons", "icon.png"),
    join(process.resourcesPath, "icons", "icon.png"),
    join(currentDir, "..", "..", "..", "resources", "icons", "icon.png")
  ];
  return candidates.find((path) => existsSync(path));
}

function createTray(mainWindow: BrowserWindow, iconPath: string | undefined): void {
  if (!iconPath || tray) return;
  
  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip(ufrenBrand.productName);
  tray.setContextMenu(contextMenu);
  
  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

function createMainWindow(): BrowserWindow {
  const iconPath = resolveWindowIconPath();
  if (!existsSync(appEnvironment.preloadPath)) {
    mainLogger.error(`${ufrenBrand.productName} preload entry is missing`, {
      preloadPath: appEnvironment.preloadPath
    });
  }
  const mainWindow = new BrowserWindow({
    title: ufrenBrand.productName,
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    backgroundColor: "#0B1020",
    frame: false,
    icon: iconPath,
    webPreferences: {
      preload: appEnvironment.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    createTray(mainWindow, iconPath);
  });
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.webContents.on("did-fail-load", (_event, code, description, validatedUrl) => {
    mainLogger.error(`${ufrenBrand.productName} renderer failed to load`, {
      code,
      description,
      validatedUrl
    });
  });
  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    if (level < 2) {
      return;
    }
    mainLogger.error(`${ufrenBrand.productName} renderer console message`, {
      level,
      message,
      line,
      sourceId
    });
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    mainLogger.error(`${ufrenBrand.productName} renderer process terminated`, {
      reason: details.reason,
      exitCode: details.exitCode
    });
  });

  if (appEnvironment.isDev) {
    void mainWindow.loadURL(appEnvironment.rendererDevUrl);
  } else {
    void mainWindow.loadFile(join(currentDir, "..", "..", "renderer", "dist", "index.html"));
  }

  return mainWindow;
}

async function bootstrap(): Promise<void> {
  app.setName(ufrenBrand.productName);
  app.setAppUserModelId("com.ufren.hermes.desktop");
  initializeLogger({
    logDir: app.getPath("logs"),
    fileName: "backend.log",
    consoleMinLevel: appEnvironment.isDev ? "debug" : "info",
    fileMinLevel: "debug"
  });
  process.on("uncaughtException", (error) => {
    mainLogger.error(`${ufrenBrand.productName} uncaught exception`, undefined, error);
  });
  process.on("unhandledRejection", (reason) => {
    mainLogger.error(`${ufrenBrand.productName} unhandled rejection`, {
      reason: String(reason)
    });
  });

  const runtimeService = new RuntimeService();
  const dashboardService = new DashboardService();
  const chatService = new ChatService();
  const installerService = new InstallerService();
  registerRuntimeHandlers(runtimeService);
  registerDashboardHandlers(dashboardService);
  registerChatHandlers(chatService);
  registerInstallerHandlers(installerService);
  registerAppLogsHandlers();
  ipcMain.handle(ipcChannels.windowMinimize, () => {
    const currentWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    currentWindow?.minimize();
  });
  ipcMain.handle(ipcChannels.windowMaximizeToggle, () => {
    const currentWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    if (!currentWindow) {
      return false;
    }
    if (currentWindow.isMaximized()) {
      currentWindow.unmaximize();
      return false;
    }
    currentWindow.maximize();
    return true;
  });
  ipcMain.handle(ipcChannels.windowClose, () => {
    const currentWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    currentWindow?.close();
  });
  ipcMain.handle(ipcChannels.openExternal, async (_, url: string) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      await shell.openExternal(url);
    }
  });
  installerService.on("contextChanged", (context: unknown) => {
    const payload = installerContextSchema.parse(context);
    mainLogger.debug("Installer context changed", payload);
    for (const windowInstance of BrowserWindow.getAllWindows()) {
      windowInstance.webContents.send(ipcChannels.installerContextChanged, payload);
    }
  });

  await app.whenReady();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      BrowserWindow.getAllWindows()[0].show();
    }
  });

  app.on("before-quit", () => {
    isQuitting = true;
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  mainLogger.info(`${ufrenBrand.productName} electron app bootstrapped`, {
    isDev: appEnvironment.isDev,
    logsPath: app.getPath("logs")
  });
}

void bootstrap();
