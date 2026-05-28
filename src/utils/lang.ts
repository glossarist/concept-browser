const LANG_NAMES: Record<string, string> = {
  eng: 'English',
  ara: 'Arabic',
  deu: 'German',
  fra: 'French',
  spa: 'Spanish',
  ita: 'Italian',
  jpn: 'Japanese',
  kor: 'Korean',
  pol: 'Polish',
  por: 'Portuguese',
  srp: 'Serbian',
  swe: 'Swedish',
  zho: 'Chinese',
  rus: 'Russian',
  fin: 'Finnish',
  dan: 'Danish',
  nld: 'Dutch',
  msa: 'Malay',
  nob: 'Norwegian Bokmål',
  nno: 'Norwegian Nynorsk',
};

export function langName(code: string): string {
  return LANG_NAMES[code] ?? code;
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
