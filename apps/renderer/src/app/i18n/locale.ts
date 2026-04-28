import type { AppLocale } from "./shared.js";

const localeStorageKey = "ufren.desktop.locale";

export function getPreferredLocale(): AppLocale {
  const stored = localStorage.getItem(localeStorageKey);
  if (stored === "zh" || stored === "en") {
    return stored;
  }

  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function persistLocale(locale: AppLocale): void {
  localStorage.setItem(localeStorageKey, locale);
}
