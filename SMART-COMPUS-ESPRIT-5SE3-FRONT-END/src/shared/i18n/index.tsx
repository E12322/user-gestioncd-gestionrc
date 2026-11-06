import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { fr, type MessageKey } from "./fr";

export type Locale = "fr" | "en";
type Dict = Record<string, string>;

const dictionaries: Record<Locale, Dict> = { fr: fr as Dict, en: {} };

/**
 * Permet à chaque module d'ajouter ses propres messages :
 *   registerMessages("fr", { "library.title": "Bibliothèque" })
 */
export function registerMessages(locale: Locale, messages: Dict) {
  dictionaries[locale] = { ...dictionaries[locale], ...messages };
}

type Params = Record<string, string | number>;
export type TFunction = (key: MessageKey | (string & {}), params?: Params) => string;

function interpolate(template: string, params?: Params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
}

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: TFunction;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("fr");
  const t = useCallback<TFunction>(
    (key, params) => interpolate(dictionaries[locale][key] ?? dictionaries.fr[key] ?? key, params),
    [locale],
  );
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n doit être utilisé dans <I18nProvider>");
  return ctx;
}

export const useT = () => useI18n().t;
