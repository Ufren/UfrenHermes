export type AppLocale = "zh" | "en";
export type LocaleBundle<T> = Record<AppLocale, T>;
export type MessageShape<T> =
  T extends (...args: infer Args) => infer Result
    ? (...args: Args) => Result
    : T extends readonly (infer Item)[]
      ? readonly MessageShape<Item>[]
      : T extends string
        ? string
        : T extends number
          ? number
          : T extends boolean
            ? boolean
            : T extends object
              ? { [K in keyof T]: MessageShape<T[K]> }
              : T;

export function pickByLocale<T>(locale: AppLocale, zh: T, en: T): T {
  return locale === "zh" ? zh : en;
}

export function createCopyGetter<const T>(bundle: LocaleBundle<T>) {
  return (locale: AppLocale): T => bundle[locale];
}

export function defineLocaleBundle<const Zh>(zh: Zh, en: MessageShape<Zh>): LocaleBundle<MessageShape<Zh>> {
  return {
    zh: zh as MessageShape<Zh>,
    en
  };
}

export function getStatusLabel(status: string, locale: AppLocale): string {
  const map = {
    idle: { zh: "空闲", en: "Idle" },
    loading: { zh: "加载中", en: "Loading" },
    ready: { zh: "就绪", en: "Ready" },
    running: { zh: "运行中", en: "Running" },
    stopped: { zh: "已停止", en: "Stopped" },
    starting: { zh: "启动中", en: "Starting" },
    installing: { zh: "安装中", en: "Installing" },
    error: { zh: "异常", en: "Error" },
    degraded: { zh: "降级", en: "Degraded" },
    not_installed: { zh: "未安装", en: "Not Installed" }
  } as const;

  const item = map[status as keyof typeof map];
  return item ? item[locale] : status;
}

export function getBooleanLabel(value: boolean | null | undefined, locale: AppLocale): string {
  if (typeof value !== "boolean") {
    return pickByLocale(locale, "未知", "Unknown");
  }

  return pickByLocale(locale, value ? "是" : "否", value ? "Yes" : "No");
}

export function getEmptyLabel(locale: AppLocale): string {
  return pickByLocale(locale, "暂无", "-");
}
