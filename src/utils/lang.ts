import { locale } from '../i18n';

const LANG_NAMES: Record<string, Record<string, string>> = {
  eng: { eng: 'English', fra: 'Anglais' },
  ara: { eng: 'Arabic', fra: 'Arabe' },
  deu: { eng: 'German', fra: 'Allemand' },
  fra: { eng: 'French', fra: 'Français' },
  spa: { eng: 'Spanish', fra: 'Espagnol' },
  ita: { eng: 'Italian', fra: 'Italien' },
  jpn: { eng: 'Japanese', fra: 'Japonais' },
  kor: { eng: 'Korean', fra: 'Coréen' },
  pol: { eng: 'Polish', fra: 'Polonais' },
  por: { eng: 'Portuguese', fra: 'Portugais' },
  srp: { eng: 'Serbian', fra: 'Serbe' },
  swe: { eng: 'Swedish', fra: 'Suédois' },
  zho: { eng: 'Chinese', fra: 'Chinois' },
  rus: { eng: 'Russian', fra: 'Russe' },
  fin: { eng: 'Finnish', fra: 'Finnois' },
  dan: { eng: 'Danish', fra: 'Danois' },
  nld: { eng: 'Dutch', fra: 'Néerlandais' },
  msa: { eng: 'Malay', fra: 'Malais' },
  nob: { eng: 'Norwegian Bokmål', fra: 'Norvégien Bokmål' },
  nno: { eng: 'Norwegian Nynorsk', fra: 'Norvégien Nynorsk' },
};

export function langName(code: string): string {
  return LANG_NAMES[code]?.[locale.value] ?? LANG_NAMES[code]?.eng ?? code;
}

export function langLabel(code: string): string {
  return code.toUpperCase();
}

const FALLBACK_LANG_ORDER = ['eng', 'fra'];

export function sortLanguages(languages: string[], order?: string[]): string[] {
  const priority = order ?? FALLBACK_LANG_ORDER;
  const index = new Map(priority.map((l, i) => [l, i]));
  return [...languages].sort((a, b) => {
    const ai = index.get(a) ?? priority.length;
    const bi = index.get(b) ?? priority.length;
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });
}

export const DEFAULT_LANG = 'eng';
