import { ref } from 'vue';

// Auto-discover all locale YAML files — adding a new .yml file is all that's needed
const localeModules = import.meta.glob<{ default: Record<string, string> }>('./locales/*.yml', { eager: true });

const messages: Record<string, Record<string, string>> = {};
const availableLocales: string[] = [];

for (const path of Object.keys(localeModules)) {
  const code = path.match(/\/([^/]+)\.yml$/)?.[1];
  if (code) {
    messages[code] = localeModules[path].default || {};
    availableLocales.push(code);
  }
}

const DEFAULT_LANG = 'eng';
const stored = typeof localStorage !== 'undefined'
  ? (localStorage.getItem('ui-lang') || DEFAULT_LANG)
  : DEFAULT_LANG;
const locale = ref(stored);

export function useI18n() {
  function t(key: string, params?: Record<string, string>): string {
    let msg = messages[locale.value]?.[key] || messages[DEFAULT_LANG]?.[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        msg = msg.replace(`{${k}}`, v);
      }
    }
    return msg;
  }

  function setLocale(lang: string) {
    locale.value = lang;
    localStorage.setItem('ui-lang', lang);
  }

  function initLocale(configuredDefault?: string) {
    const storedLang = localStorage.getItem('ui-lang');
    if (storedLang && availableLocales.includes(storedLang)) {
      locale.value = storedLang;
    } else if (configuredDefault && availableLocales.includes(configuredDefault)) {
      locale.value = configuredDefault;
    }
  }

  return { locale, t, setLocale, initLocale, availableLocales };
}
