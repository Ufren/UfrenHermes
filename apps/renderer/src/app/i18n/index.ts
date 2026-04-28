export { getAppCopy } from "./app.js";
export { getChatConsoleCopy } from "./chat.js";
export { getDashboardCopy } from "./dashboard.js";
export { getInstallerCopy } from "./installer.js";
export { getPreferredLocale, persistLocale } from "./locale.js";
export { getMessages, messageRegistry, type MessageNamespace } from "./registry.js";
export { getRuntimeCopy } from "./runtime.js";
export { getWorkspaceCopy } from "./workspace.js";
export {
  createCopyGetter,
  defineLocaleBundle,
  getBooleanLabel,
  getEmptyLabel,
  getStatusLabel,
  type MessageShape,
  pickByLocale,
  type AppLocale,
  type LocaleBundle
} from "./shared.js";
